//! Job handlers. To add a job type: create a module implementing
//! [`crate::handler::JobHandler`] and add one `register` line below (plus the
//! matching allowlist entry in `apps/api/src/modules/jobs/job-types.ts`).

pub mod catalog;
pub mod movie_search;
pub mod search;

use std::sync::Arc;

use crate::config::Config;
use crate::handler::Registry;

pub fn registry(config: &Config) -> Registry {
    let meilisearch = Arc::new(config.meilisearch.clone());
    let mut registry = Registry::new();
    registry.register(search::SearchReindexHandler {
        meilisearch: meilisearch.clone(),
    });
    registry.register(search::SearchSyncHandler {
        meilisearch: meilisearch.clone(),
    });
    registry.register(movie_search::MovieSearchHandler { meilisearch });
    registry.register(catalog::CatalogPopularityHandler);
    registry.register(catalog::game_import::GameImportHandler);
    registry.register(catalog::game_completion_times::GameCompletionTimesHandler);
    registry.register(catalog::movies::CatalogMoviesHandler);
    registry.register(catalog::movie_popularity::MoviePopularityHandler);
    registry.register(catalog::movie_titles::MovieEnglishTitlesHandler);
    registry.register(catalog::tv_series::TvCatalogHandler);
    registry.register(catalog::tv_series::TvPopularityHandler);
    registry.register(catalog::tv_series::TvSearchHandler);
    registry
}
