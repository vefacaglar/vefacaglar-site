//! Real Meilisearch checks for the index jobs. Only use a throwaway server:
//! these tests delete and rebuild the stable search indexes.
//!
//!   docker run -d --rm -p 7701:7700 -e MEILI_MASTER_KEY=testkey getmeili/meilisearch:v1.56.2
//!   WORKER_TEST_MEILISEARCH_URL=http://localhost:7701 WORKER_TEST_MEILISEARCH_API_KEY=testkey \
//!     cargo test --test meilisearch_integration
//!
//! With `WORKER_TEST_DATABASE_URL` (a disposable, migrated database) the movie
//! and people jobs also run end to end against PostgreSQL.

use std::sync::Mutex;
use std::time::Duration;

use anyhow::Result;
use async_trait::async_trait;
use chrono::Utc;
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;
use worker::config::MeilisearchConfig;
use worker::context::{JobIo, Progress};
use worker::handler::JobOutcome;
use worker::jobs::movie_search::{self, Limits};
use worker::jobs::search::backend::{MeilisearchClient, SearchBackend, settings_match};
use worker::jobs::search::indexes::{INDEXES, Source};
use worker::jobs::search::source::{DocPage, SourceData};
use worker::jobs::search::{full, rebuild_reason, sync};
use worker::queue::LogLevel;

fn client() -> Option<MeilisearchClient> {
    let url = std::env::var("WORKER_TEST_MEILISEARCH_URL").ok()?;
    let key = std::env::var("WORKER_TEST_MEILISEARCH_API_KEY").ok();
    let config = MeilisearchConfig::from_values(Some(url), key).expect("valid test URL");
    Some(
        MeilisearchClient::with_timeouts(&config, Duration::from_secs(20), Duration::from_secs(60))
            .unwrap(),
    )
}

#[derive(Default)]
struct Io {
    logs: Mutex<Vec<String>>,
    checkpoint: Mutex<Option<Value>>,
}
#[async_trait]
impl JobIo for Io {
    fn should_stop(&self) -> bool {
        false
    }
    fn is_cancel_requested(&self) -> bool {
        false
    }
    async fn log(&self, _: LogLevel, message: &str) {
        self.logs.lock().unwrap().push(message.to_owned());
    }
    async fn progress(&self, _: &Progress) -> Result<()> {
        Ok(())
    }
    async fn checkpoint(&self, _: &Progress, checkpoint: Value) -> Result<()> {
        *self.checkpoint.lock().unwrap() = Some(checkpoint);
        Ok(())
    }
}

/// `per_index` documents for every games-family index, ids `index*1e6+n`.
struct Rows {
    per_index: usize,
    title: &'static str,
}
impl Rows {
    fn rows(&self, source: Source) -> Vec<(Uuid, Value)> {
        let index = INDEXES.iter().position(|s| s.source == source).unwrap();
        (1..=self.per_index)
            .map(|n| {
                let id = Uuid::from_u128(index as u128 * 1_000_000 + n as u128);
                let doc = match source {
                    Source::Games => json!({ "id": id.to_string(), "slug": format!("g{n}"),
                        "title": format!("{} {n}", self.title), "popularityScore": n as f64,
                        "releaseTimestamp": 0, "createdAt": 1 }),
                    Source::Posts => json!({ "id": id.to_string(), "slug": format!("p{n}"),
                        "title": format!("{} {n}", self.title), "publishedAt": 1, "createdAt": 1 }),
                    Source::Lookup(_) => json!({ "id": id.to_string(), "slug": format!("l{n}"),
                        "name": format!("{} {n}", self.title), "createdAt": 1 }),
                };
                (id, doc)
            })
            .collect()
    }
}
#[async_trait]
impl SourceData for Rows {
    async fn count(&self, source: Source, up_to: Option<Uuid>) -> Result<u64> {
        Ok(self
            .rows(source)
            .iter()
            .filter(|(id, _)| up_to.is_none_or(|u| *id <= u))
            .count() as u64)
    }
    async fn docs_page(
        &self,
        source: Source,
        after: Option<Uuid>,
        limit: usize,
    ) -> Result<DocPage> {
        let page: Vec<(Uuid, Value)> = self
            .rows(source)
            .into_iter()
            .filter(|(id, _)| after.is_none_or(|a| *id > a))
            .take(limit)
            .collect();
        Ok(DocPage {
            last_id: page.last().map(|(id, _)| *id),
            docs: page.into_iter().map(|(_, d)| d).collect(),
        })
    }
    async fn ids_page(
        &self,
        source: Source,
        after: Option<Uuid>,
        limit: usize,
    ) -> Result<Vec<Uuid>> {
        Ok(self
            .rows(source)
            .into_iter()
            .map(|(id, _)| id)
            .filter(|id| after.is_none_or(|a| *id > a))
            .take(limit)
            .collect())
    }
    async fn docs_by_ids(&self, source: Source, ids: &[Uuid]) -> Result<Vec<Value>> {
        Ok(self
            .rows(source)
            .into_iter()
            .filter(|(id, _)| ids.contains(id))
            .map(|(_, d)| d)
            .collect())
    }
}

/// Tests run in parallel against one server, so each only checks its own builds.
fn is_games_build(name: &str) -> bool {
    INDEXES
        .iter()
        .any(|spec| name.starts_with(&format!("{}__build_", spec.name)))
}

async fn reset(backend: &MeilisearchClient, prefixes: &[&str]) {
    for name in backend.list_indexes().await.unwrap() {
        if prefixes.iter().any(|prefix| name.starts_with(prefix)) {
            backend.delete_index(&name).await.unwrap();
        }
    }
}

#[tokio::test]
async fn games_family_build_swap_and_sync_against_meilisearch() {
    let Some(backend) = client() else {
        eprintln!("WORKER_TEST_MEILISEARCH_URL not set; skipping");
        return;
    };
    let names: Vec<&str> = INDEXES.iter().map(|s| s.name).collect();
    reset(&backend, &names).await;
    assert!(rebuild_reason(&backend).await.unwrap().is_some());

    // First build: no stable index exists, so each build is renamed in.
    let first = Rows {
        per_index: 1203,
        title: "First",
    };
    let io = Io::default();
    let outcome = full::run(&io, &backend, &first, None, Utc::now())
        .await
        .unwrap();
    assert_eq!(outcome, JobOutcome::Completed);
    assert_eq!(rebuild_reason(&backend).await.unwrap(), None);
    let all = backend.list_indexes().await.unwrap();
    assert!(all.iter().all(|n| !is_games_build(n)), "{all:?}");
    for spec in INDEXES.iter() {
        assert_eq!(backend.document_ids(spec.name).await.unwrap().len(), 1203);
        let settings = backend.settings(spec.name).await.unwrap().unwrap();
        assert!(settings_match(&settings, &spec.settings()), "{}", spec.name);
    }

    // Rebuild: stable indexes exist, so the build is swapped in atomically
    // and the swapped-out build is deleted.
    let second = Rows {
        per_index: 10,
        title: "Second",
    };
    let outcome = full::run(
        &Io::default(),
        &backend,
        &second,
        None,
        Utc::now() + chrono::Duration::seconds(2),
    )
    .await
    .unwrap();
    assert_eq!(outcome, JobOutcome::Completed);
    assert_eq!(backend.document_ids("games_en").await.unwrap().len(), 10);
    let all = backend.list_indexes().await.unwrap();
    assert!(all.iter().all(|n| !is_games_build(n)), "{all:?}");

    // Sync re-adds deleted documents; orphans are left alone.
    let missing: Vec<String> = second
        .rows(Source::Games)
        .into_iter()
        .take(4)
        .map(|(id, _)| id.to_string())
        .collect();
    backend
        .delete_documents("games_en", &missing)
        .await
        .unwrap();
    backend
        .add_documents(
            "posts_en",
            &[json!({ "id": "orphan", "title": "x", "publishedAt": 1, "createdAt": 1 })],
        )
        .await
        .unwrap();
    let io = Io::default();
    assert_eq!(
        sync::run(&io, &backend, &second, None).await.unwrap(),
        JobOutcome::Completed
    );
    assert_eq!(backend.document_ids("games_en").await.unwrap().len(), 10);
    assert_eq!(backend.document_ids("posts_en").await.unwrap().len(), 11);
    assert!(
        io.logs
            .lock()
            .unwrap()
            .iter()
            .any(|l| l.starts_with("games_en: 4 missing"))
    );

    // A settings drift is detected (and would escalate the sync).
    backend
        .create_index(
            "games_en",
            &json!({ "pagination": { "maxTotalHits": 1000 } }),
        )
        .await
        .unwrap();
    assert_eq!(
        rebuild_reason(&backend).await.unwrap().as_deref(),
        Some("index games_en has outdated settings")
    );

    // A rejected batch fails the whole task with a Meilisearch code.
    let error = backend
        .add_documents("games_en", &[json!({ "id": "not valid!" })])
        .await
        .unwrap_err();
    assert!(
        format!("{error:#}").contains("invalid_document_id"),
        "{error:#}"
    );
}

#[tokio::test]
async fn swap_history_tells_whether_a_build_was_swapped() {
    let Some(backend) = client() else {
        eprintln!("WORKER_TEST_MEILISEARCH_URL not set; skipping");
        return;
    };
    let stable = format!("swaptest_{}", Uuid::new_v4().simple());
    let build = format!("{stable}__build_1");
    reset(&backend, &[&stable]).await;
    backend.create_index(&build, &json!({})).await.unwrap();
    assert!(!backend.was_swapped(&build).await.unwrap());
    backend.swap_indexes(&[(&stable, &build)]).await.unwrap(); // rename
    assert!(backend.was_swapped(&build).await.unwrap());
    assert!(backend.index_exists(&stable).await.unwrap());
    assert!(!backend.index_exists(&build).await.unwrap());
    assert!(!backend.delete_index(&build).await.unwrap());
    let second = format!("{stable}__build_2");
    backend.create_index(&second, &json!({})).await.unwrap();
    backend.swap_indexes(&[(&stable, &second)]).await.unwrap(); // swap
    assert!(backend.was_swapped(&second).await.unwrap());
    assert!(backend.index_exists(&second).await.unwrap());
    reset(&backend, &[&stable]).await;
}

#[tokio::test]
async fn movie_and_people_jobs_publish_stable_indexes_from_postgres() {
    let Some(backend) = client() else {
        eprintln!("WORKER_TEST_MEILISEARCH_URL not set; skipping");
        return;
    };
    let Ok(url) = std::env::var("WORKER_TEST_DATABASE_URL") else {
        eprintln!("WORKER_TEST_DATABASE_URL not set; skipping");
        return;
    };
    let pool = PgPool::connect(&url).await.unwrap();
    reset(&backend, &["movies_en", "movie_people_en"]).await;
    // Typesense-era state, as left by the previous deployment.
    sqlx::query("INSERT INTO movie_search_state (id) VALUES ('movies_en') ON CONFLICT DO NOTHING")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE movie_search_state SET schema_version=2, active_collection='movies_en__v2_old', building_collection=NULL, bootstrap_phase='ready', ranking_ready=true WHERE id='movies_en'")
        .execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO movie_people_search_state (id) VALUES ('movie_people_en') ON CONFLICT DO NOTHING")
        .execute(&pool).await.unwrap();
    sqlx::query("UPDATE movie_people_search_state SET schema_version=1, active_collection='movie_people_en__v1_old', building_collection=NULL, published_at=now() WHERE id='movie_people_en'")
        .execute(&pool).await.unwrap();
    let movie = Uuid::new_v4();
    let person = Uuid::new_v4();
    let qid = format!("Q{}", 900_000_000 + movie.as_u128() % 1_000_000);
    sqlx::query("INSERT INTO movies (id,wikidata_id,slug,title,is_film,hydrated_at) VALUES ($1,$2,$2,'Integration Movie',true,now())")
        .bind(movie).bind(&qid).execute(&pool).await.unwrap();
    sqlx::query(
        "INSERT INTO movie_people (id,wikidata_id,name) VALUES ($1,$2,'Integration Person')",
    )
    .bind(person)
    .bind(&qid)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO movie_credits (movie_id,person_id,statement_id,role_property,rank) VALUES ($1,$2,'s','P161','normal')")
        .bind(movie).bind(person).execute(&pool).await.unwrap();

    let source = movie_search::source::PgMovieSource { pool: pool.clone() };
    let limits = Limits {
        documents: 1_000_000,
        duration: Duration::from_secs(120),
    };
    let outcome = movie_search::run(&Io::default(), &backend, &source, limits)
        .await
        .unwrap();
    assert_eq!(outcome, JobOutcome::Completed);
    let state: (i32, Option<String>, Option<String>, String, bool) = sqlx::query_as(
        "SELECT schema_version, active_collection, building_collection, bootstrap_phase, ranking_ready FROM movie_search_state WHERE id='movies_en'",
    )
    .fetch_one(&pool).await.unwrap();
    assert_eq!(
        state,
        (3, Some("movies_en".into()), None, "ready".into(), true)
    );
    let public: i64 = sqlx::query_scalar("SELECT count(*) FROM movies m WHERE m.is_film AND m.hydrated_at IS NOT NULL AND m.title IS NOT NULL")
        .fetch_one(&pool).await.unwrap();
    let ids = backend.document_ids("movies_en").await.unwrap();
    assert_eq!(ids.len() as i64, public);
    assert!(ids.contains(&movie.to_string()));
    let settings = backend.settings("movies_en").await.unwrap().unwrap();
    assert!(settings_match(&settings, &movie_search::index_settings()));
    assert!(
        backend
            .list_indexes()
            .await
            .unwrap()
            .iter()
            .all(|n| !n.starts_with("movies_en__build_"))
    );

    // Steady state: a hidden movie is removed from the live index directly.
    sqlx::query("UPDATE movies SET is_film=false WHERE id=$1")
        .bind(movie)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "UPDATE movie_search_sync SET requested_revision=requested_revision+1 WHERE movie_id=$1",
    )
    .bind(movie)
    .execute(&pool)
    .await
    .unwrap();
    movie_search::run(&Io::default(), &backend, &source, limits)
        .await
        .unwrap();
    assert!(
        !backend
            .document_ids("movies_en")
            .await
            .unwrap()
            .contains(&movie.to_string())
    );

    let people = movie_search::people::PgPeopleSource { pool: pool.clone() };
    sqlx::query("UPDATE movies SET is_film=true WHERE id=$1")
        .bind(movie)
        .execute(&pool)
        .await
        .unwrap();
    let outcome =
        movie_search::people::run_people(&Io::default(), &backend, &people, limits, Utc::now())
            .await
            .unwrap();
    assert_eq!(outcome, movie_search::people::PeopleOutcome::Published);
    let people_state: (i32, Option<String>, Option<String>) = sqlx::query_as(
        "SELECT schema_version, active_collection, building_collection FROM movie_people_search_state WHERE id='movie_people_en'",
    )
    .fetch_one(&pool).await.unwrap();
    assert_eq!(people_state, (2, Some("movie_people_en".into()), None));
    assert!(
        backend
            .document_ids("movie_people_en")
            .await
            .unwrap()
            .contains(&person.to_string())
    );
    // A second run within the refresh interval is idle.
    assert_eq!(
        movie_search::people::run_people(&Io::default(), &backend, &people, limits, Utc::now())
            .await
            .unwrap(),
        movie_search::people::PeopleOutcome::Idle
    );

    sqlx::query("DELETE FROM movie_credits WHERE movie_id=$1")
        .bind(movie)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM movies WHERE id=$1")
        .bind(movie)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM movie_people WHERE id=$1")
        .bind(person)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM movie_search_sync WHERE movie_id=$1")
        .bind(movie)
        .execute(&pool)
        .await
        .unwrap();
    pool.close().await;
}
