//! Real generated-schema validation. Only use a disposable database: this test
//! resets the movie search singleton and writes/deletes catalog fixture rows.
use chrono::NaiveDate;
use sqlx::{PgPool, Row};
use uuid::Uuid;
use worker::jobs::movie_search::source::{MovieSource, PgMovieSource};

#[tokio::test]
async fn durable_movie_capture_ack_publication_and_tombstones() {
    let Ok(url) = std::env::var("WORKER_TEST_DATABASE_URL") else {
        eprintln!("WORKER_TEST_DATABASE_URL not set; skipping");
        return;
    };
    let pool = PgPool::connect(&url).await.unwrap();
    let source = PgMovieSource { pool: pool.clone() };
    let id = Uuid::new_v4();
    let person = Uuid::new_v4();
    let qid = format!("Q{}", id.as_u128() % 1_000_000_000);
    let target = "movies_en__v2_integration";
    let date = NaiveDate::from_ymd_opt(2026, 11, 5).unwrap();
    source.state().await.unwrap();
    source.start_build(target).await.unwrap();
    sqlx::query("UPDATE movie_search_state SET repair_cursor=NULL,repair_completed_at=NULL WHERE id='movies_en'")
        .execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO movie_popularity_state (id,source_date) VALUES ('enwiki-top-articles-v1',$1) ON CONFLICT (id) DO UPDATE SET source_date=$1")
        .bind(date).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO movies (id,wikidata_id,slug,title,is_film,hydrated_at,wikipedia_views,wikipedia_source_date) VALUES ($1,$2,$2,'Captured Movie',true,now(),42,$3)")
        .bind(id).bind(&qid).bind(date).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO movie_people (id,wikidata_id,name) VALUES ($1,$2,'Person')")
        .bind(person)
        .bind(&qid)
        .execute(&pool)
        .await
        .unwrap();
    for (statement, rank) in [("a", "normal"), ("b", "normal"), ("c", "deprecated")] {
        sqlx::query("INSERT INTO movie_credits (movie_id,person_id,statement_id,role_property,rank) VALUES ($1,$2,$3,'P161',$4)")
            .bind(id).bind(person).bind(statement).bind(rank).execute(&pool).await.unwrap();
    }
    let scan = source.scan(None, 500).await.unwrap();
    let captured = scan.rows.iter().find(|row| row.id == id).unwrap().clone();
    let doc = captured.document.as_ref().unwrap();
    assert_eq!(doc["interestScore"], 42);
    assert_eq!(doc["recognitionCount"], 0);
    assert_eq!(doc["interestRecognitionRank"], 43_000_000);
    assert_eq!(doc["personQids"], serde_json::json!([qid]));
    assert_eq!(scan.publication.source_date, Some(date));
    // A source change committed after capture must survive acknowledgement.
    sqlx::query(
        "UPDATE movie_search_sync SET requested_revision=requested_revision+1 WHERE movie_id=$1",
    )
    .bind(id)
    .execute(&pool)
    .await
    .unwrap();
    source.ack(target, &scan.rows).await.unwrap();
    source
        .advance_scan(target, scan.last_id, true)
        .await
        .unwrap();
    assert!(!source.can_publish(target, scan.publication).await.unwrap());
    let dirty = source.dirty(target, true, 500).await.unwrap();
    assert!(
        dirty
            .rows
            .iter()
            .any(|row| row.id == id && row.revision == captured.revision + 1)
    );
    source.ack(target, &dirty.rows).await.unwrap();
    assert!(source.can_publish(target, dirty.publication).await.unwrap());
    assert!(source.publish(target, dirty.publication).await.unwrap());
    let state = sqlx::query(
        "SELECT ranking_ready,published_source_date FROM movie_search_state WHERE id='movies_en'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(state.get::<bool, _>("ranking_ready"));
    assert_eq!(
        state.get::<Option<NaiveDate>, _>("published_source_date"),
        Some(date)
    );
    // Cast the interest score before multiplication: valid int32 observations
    // must not overflow PostgreSQL int32 or JavaScript's safe integer range.
    sqlx::query(
        "UPDATE movies SET wikipedia_views=2147483647,wikipedia_language_count=999999 WHERE id=$1",
    )
    .bind(id)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "UPDATE movie_search_sync SET requested_revision=requested_revision+1 WHERE movie_id=$1",
    )
    .bind(id)
    .execute(&pool)
    .await
    .unwrap();
    let maximum = source.dirty(target, false, 500).await.unwrap();
    let maximum_doc = maximum
        .rows
        .iter()
        .find(|row| row.id == id)
        .unwrap()
        .document
        .as_ref()
        .unwrap();
    assert_eq!(maximum_doc["recognitionCount"], 999_999);
    assert_eq!(
        maximum_doc["interestRecognitionRank"],
        2_147_483_648_999_999_i64
    );
    source.ack(target, &maximum.rows).await.unwrap();
    for invalid in [-1, 1_000_000] {
        assert!(
            sqlx::query("UPDATE movies SET wikipedia_language_count=$2 WHERE id=$1")
                .bind(id)
                .bind(invalid)
                .execute(&pool)
                .await
                .is_err()
        );
    }
    // The ledger intentionally survives canonical hard deletion.
    sqlx::query("DELETE FROM movies WHERE id=$1")
        .bind(id)
        .execute(&pool)
        .await
        .unwrap();
    assert!(source.repair_due().await.unwrap());
    source.repair(500).await.unwrap();
    let deleted = source.dirty(target, false, 500).await.unwrap();
    assert!(
        deleted
            .rows
            .iter()
            .any(|row| row.id == id && row.document.is_none())
    );
    source.ack(target, &deleted.rows).await.unwrap();
    assert!(
        source
            .dirty(target, false, 500)
            .await
            .unwrap()
            .rows
            .is_empty()
    );
    assert!(!source.remaining(target).await.unwrap());
    sqlx::query("DELETE FROM movie_search_sync WHERE movie_id=$1")
        .bind(id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM movie_people WHERE id=$1")
        .bind(person)
        .execute(&pool)
        .await
        .unwrap();
    pool.close().await;
}
