import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { MarketRadarMatrixRow } from './market-radar-matrix.service';

export interface ExportJobItem {
  fitScore: number;
  fitLabel: string;
  jobTitle: string;
  budget: string;
  clientCountry: string;
  clientRating: number;
  clientTotalSpent: number;
  verifiedPayment: string;
  proposalsAlreadyIn: number;
  contactNameFound?: string;
  coverLetter?: string;
  proposalDocLink?: string;
  applyLink?: string;
  status: string;
  dateScraped: string;
  scoreNotes?: string;
  laneCategory?: string;
  postedAt?: string | null;
}

@Injectable()
export class ExcelExportService {
  private readonly logger = new Logger(ExcelExportService.name);

  public async generateReportWorkbook(
    allJobs: ExportJobItem[],
    radarMatrix: MarketRadarMatrixRow[],
    personaName = 'Armando Russi'
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Proposal Autopilot';
    workbook.lastModifiedBy = personaName;
    workbook.created = new Date();
    workbook.modified = new Date();

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };

    const headerFont: Partial<ExcelJS.Font> = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };

    const jobHeaders = [
      'Fit Score',
      'Fit Label',
      'Job Title',
      'Budget',
      'Client Country',
      'Client Rating',
      'Client Total Spent',
      'Verified Payment',
      'Proposals Already In',
      'Contact Name Found',
      'Cover Letter',
      'Proposal Doc Link',
      'Apply Link',
      'Status',
      'Date Scraped',
      'Score Notes',
      'Lane / Category',
      'Opportunity Score',
      'Priority (fit + opportunity)',
    ];

    const formatJobSheet = (sheet: ExcelJS.Worksheet, jobs: ExportJobItem[]) => {
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: jobHeaders.length },
      };

      const headerRow = sheet.addRow(jobHeaders);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = thinBorder;
      });

      for (const j of jobs) {
        const row = sheet.addRow([
          j.fitScore,
          j.fitLabel,
          j.jobTitle,
          j.budget,
          j.clientCountry,
          j.clientRating,
          j.clientTotalSpent,
          j.verifiedPayment,
          j.proposalsAlreadyIn,
          j.contactNameFound || '',
          j.coverLetter || '',
          j.proposalDocLink || '',
          j.applyLink || '',
          j.status,
          j.dateScraped,
          j.scoreNotes || '',
          j.laneCategory || '',
          '',
          j.fitScore,
        ]);
        row.height = 20;
        row.eachCell((cell, colNumber) => {
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle' };
          // Number format for client total spend
          if (colNumber === 7) {
            cell.numFmt = '$#,##0.00';
          }
        });
      }

      // Auto-fit widths with sensible bounds
      sheet.columns.forEach((column) => {
        let maxLen = 12;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
          const valStr = cell.value ? cell.value.toString() : '';
          if (valStr.length > maxLen) {
            maxLen = Math.min(valStr.length + 3, 55);
          }
        });
        column.width = maxLen;
      });
    };

    // 1. Pipeline Sheet
    const pipelineSheet = workbook.addWorksheet('Pipeline');
    formatJobSheet(pipelineSheet, allJobs);

    // 2. Today Sheet (Jobs posted in last 24h / starting with today's date)
    const todaySheet = workbook.addWorksheet('Today');
    const nowEpoch = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    const todayJobs = allJobs.filter((j) => {
      if (!j.postedAt) return false;
      const postedEpoch = new Date(j.postedAt).getTime();
      return nowEpoch - postedEpoch <= twentyFourHoursMs;
    });
    formatJobSheet(todaySheet, todayJobs.length > 0 ? todayJobs : allJobs.slice(0, 34));

    // 3. Leaderboard Sheet (Market Radar Matrix with 29 Columns)
    const leaderboardSheet = workbook.addWorksheet('Leaderboard');
    leaderboardSheet.views = [{ state: 'frozen', ySplit: 1 }];
    const leaderboardHeaders = [
      'Rank',
      'Category',
      'Lane',
      'Overall (opportunity + your fit)',
      'Opportunity (market)',
      'Personal fit (skills + AI ease)',
      'Recency (fresh listings)',
      'Trending (demand + change)',
      'Supply pressure (proxy)',
      'Submissions (few proposals)',
      'Client quality (spend record)',
      'New jobs per hour (our scrape)',
      'Upwork-wide trend: share of all postings, year over year',
      'Upwork-wide momentum: last 3 months vs prior 3',
      'Upwork postings per month (this skill)',
      'Postings now vs all-time peak',
      'Change vs our previous scrape',
      'Median listing age (hrs)',
      '% jobs with 25+ proposals',
      'Median proposals',
      'Median client spend (USD)',
      '% verified clients',
      'Median hourly (USD)',
      'Median fixed (USD)',
      'Skill affinity',
      'AI ease',
      'Relevant jobs sampled',
      'Runs averaged',
      'Updated',
    ];

    leaderboardSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: leaderboardHeaders.length },
    };

    const lHeaderRow = leaderboardSheet.addRow(leaderboardHeaders);
    lHeaderRow.height = 28;
    lHeaderRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    });

    for (const r of radarMatrix) {
      const row = leaderboardSheet.addRow([
        r.rank,
        r.category,
        r.lane,
        r.overallScore,
        r.opportunityScore,
        r.personalFitScore,
        r.recencyScore,
        r.trendingScore,
        r.supplyPressureScore,
        r.submissionsScore,
        r.clientQualityScore,
        r.newJobsPerHour,
        r.shareYearOverYearPct != null ? (r.shareYearOverYearPct / 100) : null,
        r.shareMomentumPct != null ? (r.shareMomentumPct / 100) : null,
        r.postingsPerMonth,
        r.postingsVsPeakPct != null ? (r.postingsVsPeakPct / 100) : null,
        r.changeVsPreviousScrapePct != null ? (r.changeVsPreviousScrapePct / 100) : null,
        r.medianListingAgeHours,
        r.pctJobsWith25PlusProposals != null ? (r.pctJobsWith25PlusProposals / 100) : null,
        r.medianProposals,
        r.medianClientSpend,
        r.verifiedClientsPct != null ? (r.verifiedClientsPct / 100) : null,
        r.medianHourlyRate,
        r.medianFixedBudget,
        r.skillAffinity,
        r.aiEase,
        r.sampleJobs,
        r.runsAveraged,
        r.updated,
      ]);
      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle' };
        // Format percentages
        if ([13, 14, 16, 17, 19, 22].includes(colNumber) && cell.value != null) {
          cell.numFmt = '0.0%';
        }
        // Format currency
        if ([21, 23, 24].includes(colNumber) && cell.value != null) {
          cell.numFmt = '$#,##0.00';
        }
      });
    }

    leaderboardSheet.columns.forEach((column) => {
      let maxLen = 12;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const valStr = cell.value ? cell.value.toString() : '';
        if (valStr.length > maxLen) {
          maxLen = Math.min(valStr.length + 3, 40);
        }
      });
      column.width = maxLen;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
