import React, { useState } from 'react';
import { Card, Button, Badge } from '@police-directory/ui';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, RotateCcw, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '@police-directory/shared';

export const ExcelImport: React.FC = () => {
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any | null>(null);
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitResult, setCommitResult] = useState<any | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackResult, setRollbackResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Template download helper
  const handleDownloadTemplate = () => {
    const headers = [
      ['PNO', 'Name', 'Post', 'District', 'Office', 'Phone', 'WhatsApp', 'Email', 'Status', 'Remarks'],
      ['00987654', 'Ajay Pratap Singh', 'Inspector of Police', 'Lucknow', 'PS Hazratganj', '9876543210', '9876543210', 'ajay.singh@uppolice.gov.in', 'ACTIVE', 'Service record verified'],
      ['00876543', 'Brijesh Yadav', 'Sub-Inspector of Police', 'Lucknow', 'PS Hazratganj', '9812345678', '', '', 'ACTIVE', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personnel_Template');
    XLSX.writeFile(wb, 'UP_Police_Personnel_Template.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrorMessage(null);
    setDryRunResult(null);
    setCommitResult(null);
    setRollbackResult(null);
    setParsing(true);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Parse headers explicitly
      const rawJson = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, raw: false });
      if (!rawJson || rawJson.length < 2) {
        throw new Error('Spreadsheet must contain a header row and at least one data row.');
      }

      const headers = (rawJson[0] as string[]).map((h) => String(h || '').trim());
      
      // Parse data rows as object with raw string preservation
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { raw: false });

      // Stage 3: Send to dry run validation endpoint
      setDryRunLoading(true);
      const dryRunRes = await api.excelDryRun({
        fileName: selectedFile.name,
        headers,
        rows,
      });

      setDryRunResult(dryRunRes);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse Excel file.');
    } finally {
      setParsing(false);
      setDryRunLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!dryRunResult?.jobId) return;
    setCommitLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.excelCommit({
        jobId: dryRunResult.jobId,
        validRows: dryRunResult.previewRows,
      });
      setCommitResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Commit failed');
    } finally {
      setCommitLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!dryRunResult?.jobId) return;
    if (!confirm('Are you sure you want to rollback this import batch? Prior values will be restored.')) return;

    setRollbackLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.excelRollback(dryRunResult.jobId);
      setRollbackResult(res.message);
      setCommitResult(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Rollback failed');
    } finally {
      setRollbackLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview & Template */}
      <Card className="p-6">
        <div className="sm:flex sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              6-Stage Excel Personnel Bulk Import
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Strict English/ASCII template validation, safe string handling for PNO/Mobile (preserves leading zeros), mandatory dry-run preview, transactional upsert, and snapshot rollback.
            </p>
          </div>
          <div className="mt-3 sm:mt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              aria-label="Download official English-only Excel template"
              icon={<Download className="w-3.5 h-3.5" />}
              className="text-xs font-semibold rounded-xl"
            >
              Download Template
            </Button>
          </div>
        </div>

        {/* Upload Dropzone */}
        <div className="mt-5 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-[#17324F] transition-colors">
          <FileSpreadsheet className="w-10 h-10 text-[#147D84] mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Select or drag & drop .xlsx personnel file
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Only official English headers accepted: PNO, Name, Post, District, Office, Phone...
          </p>
          <label className="mt-3 inline-block">
            <span className="px-4 py-2 bg-[#17324F] hover:bg-[#10243B] text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm transition-all inline-block">
              Browse File
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </Card>

      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-3 text-xs text-red-800 dark:text-red-300">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <h4 className="font-bold">Validation / Import Error</h4>
            <p className="mt-0.5 whitespace-pre-wrap">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Stage 3 & 4: Dry-Run Diff Preview */}
      {dryRunResult && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Stage 4: Dry-Run Verification Summary
              </h4>
              <p className="text-xs text-slate-500">
                File: {file?.name} • Batch ID: {dryRunResult.jobId}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="neutral" size="sm">
                Total: {dryRunResult.summary.totalRows}
              </Badge>
              <Badge variant="success" size="sm">
                Valid: {dryRunResult.summary.validRows}
              </Badge>
              {dryRunResult.summary.invalidRows > 0 && (
                <Badge variant="danger" size="sm">
                  Errors: {dryRunResult.summary.invalidRows}
                </Badge>
              )}
            </div>
          </div>

          {/* Preview Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-2.5">Row</th>
                  <th className="p-2.5">PNO</th>
                  <th className="p-2.5">Name</th>
                  <th className="p-2.5">Post</th>
                  <th className="p-2.5">District</th>
                  <th className="p-2.5">Office</th>
                  <th className="p-2.5">Phone</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Diff / Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dryRunResult.previewRows.map((row: any) => (
                  <tr
                    key={row.rowIndex}
                    className={
                      !row.isValid
                        ? 'bg-red-50/50 dark:bg-red-950/20'
                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                    }
                  >
                    <td className="p-2.5 font-mono text-[11px]">{row.rowIndex}</td>
                    <td className="p-2.5 font-mono font-semibold">{row.pno}</td>
                    <td className="p-2.5 font-medium">{row.name}</td>
                    <td className="p-2.5">{row.post}</td>
                    <td className="p-2.5">{row.district}</td>
                    <td className="p-2.5">{row.office}</td>
                    <td className="p-2.5 font-mono">{row.phone}</td>
                    <td className="p-2.5">
                      <Badge variant={row.isValid ? 'success' : 'danger'} size="sm">
                        {row.isValid ? row.diffType : 'REJECTED'}
                      </Badge>
                    </td>
                    <td className="p-2.5 max-w-xs truncate text-[11px]">
                      {row.errors.length > 0 ? (
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {row.errors.join('; ')}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Verified Canonical
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              {dryRunResult.allValid
                ? 'All records passed strict schema validation. Ready to commit.'
                : 'Warning: Invalid records will be omitted during commit.'}
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={handleCommit}
                loading={commitLoading}
                disabled={dryRunResult.summary.validRows === 0 || commitResult}
                aria-label="Confirm transactional import commit"
                className="bg-[#17324F] px-5 py-2 font-bold"
              >
                Confirm & Commit Import ({dryRunResult.summary.validRows} Records)
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Commit Result & Rollback Option */}
      {commitResult && (
        <Card className="p-6 bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                Import Committed Successfully
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                {commitResult.message}
              </p>
            </div>
          </div>

          {user?.role === ROLES.SUPER_ADMIN && (
            <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
              <span className="text-xs text-emerald-800 dark:text-emerald-300">
                Pre-import rollback snapshots are archived. You can revert this batch at any time.
              </span>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRollback}
                loading={rollbackLoading}
                aria-label="Rollback import batch"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                className="text-xs font-bold"
              >
                Rollback This Batch
              </Button>
            </div>
          )}
        </Card>
      )}

      {rollbackResult && (
        <Card className="p-5 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 flex items-center gap-3">
          <RotateCcw className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
            {rollbackResult}
          </p>
        </Card>
      )}
    </div>
  );
};
