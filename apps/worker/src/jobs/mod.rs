//! Job handlers. To add a job type: create a module implementing
//! [`crate::handler::JobHandler`] and add one `register` line below (plus the
//! matching allowlist entry in `apps/api/src/modules/jobs/job-types.ts`).

pub mod catalog;
pub mod search;

use std::sync::Arc;

use crate::config::Config;
use crate::handler::Registry;

pub fn registry(config: &Config) -> Registry {
    let typesense = Arc::new(config.typesense.clone());
    let mut registry = Registry::new();
    registry.register(search::SearchReindexHandler {
        typesense: typesense.clone(),
    });
    registry.register(search::SearchSyncHandler { typesense });
    registry.register(catalog::CatalogPopularityHandler);
    registry.register(catalog::movies::CatalogMoviesHandler);
    registry.register(catalog::movie_popularity::MoviePopularityHandler);
    registry
}
