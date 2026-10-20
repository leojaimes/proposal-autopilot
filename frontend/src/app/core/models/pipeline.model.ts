export interface PipelineStep {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  doneCount: number;
  totalCount: number;
  isCompleted: boolean;
}

export interface JobReportItem {
  id: string;
  fitScore: number;
  fitLabel: 'High' | 'Medium' | 'Low';
  jobTitle: string;
  budget: string;
  clientCountry: string;
  clientRating: number;
  clientTotalSpent: number;
  verifiedPayment: 'Yes' | 'No';
  proposalsAlreadyIn: number;
  postedAt?: string | null;
  contactNameFound: string;
  coverLetter: string;
  proposalDocLink: string;
  applyLink: string;
  status: 'Needs Review' | 'Approved' | 'Skipped' | 'Proposal Sent';
  dateScraped: string;
  scoreNotes: string;
  laneCategory: string;
  normalizedRole: string;
  suggestedProofStory: string;
  mermaidCode?: string;
  technicalProposal?: string;
  skillScore?: number;
  aiFeasibilityScore?: number;
  clientQualityScore?: number;
  recencyScore?: number;
  isCapped?: boolean;
  capReason?: string | null;
  drivers?: string[];
  drags?: string[];
}

export interface ProofStory {
  id: string;
  company: string;
  metric: string;
  description: string;
  tags: string[];
}
