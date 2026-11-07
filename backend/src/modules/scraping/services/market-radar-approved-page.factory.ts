import { ApifyLiveDatasetImporter } from './apify-live-dataset-importer';
import { MarketRadarApprovedPageCommand } from './market-radar-approved-page.command';
import { MarketRadarCoveragePageWorkflow } from './market-radar-coverage-page.workflow';
import { MarketRadarCoverageRunner } from './market-radar-coverage-runner';

type CoveragePages = {
  loadLastPage: (...args: any[]) => Promise<any>;
  recordPage: (...args: any[]) => Promise<unknown>;
};
type PageClient = ConstructorParameters<typeof MarketRadarCoveragePageWorkflow>[1];
type ImporterDependencies = ConstructorParameters<typeof ApifyLiveDatasetImporter>;

export function createMarketRadarApprovedPageCommand(input: {
  token: string;
  coveragePages: CoveragePages;
  pageClient: PageClient;
  readDataset: ImporterDependencies[1];
  catalog: ImporterDependencies[2];
}) {
  const importer = new ApifyLiveDatasetImporter(input.token, input.readDataset, input.catalog);
  const workflow = new MarketRadarCoveragePageWorkflow(
    new MarketRadarCoverageRunner(
      input.coveragePages as ConstructorParameters<typeof MarketRadarCoverageRunner>[0],
    ),
    input.pageClient,
    { read: (datasetId) => input.readDataset(datasetId, input.token) },
    importer,
  );
  return new MarketRadarApprovedPageCommand(workflow);
}
