import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  BookOpen,
  Download,
  ExternalLink,
  Plus,
  Trash2,
  Search,
  Filter,
  FileText,
  FileSpreadsheet,
  Calendar,
  Building2,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface Diary {
  id: string;
  title: string;
  description?: string;
  category: string;
  districtId?: string;
  districtName?: string;
  sourceDate: string;
  fileType: 'PDF' | 'XLSX' | 'XLS' | 'CSV' | 'URL';
  externalUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  downloadCount: number;
  createdAt: string;
  uploaderName?: string;
}

interface District {
  id: string;
  name: string;
}

interface ContactDiariesProps {
  currentUserRole?: string;
  districts: District[];
}

export const ContactDiaries: React.FC<ContactDiariesProps> = ({ currentUserRole, districts }) => {
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');

  // Super Admin Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadCategory, setUploadCategory] = useState('GENERAL');
  const [uploadDistrict, setUploadDistrict] = useState('');
  const [uploadSourceDate, setUploadSourceDate] = useState(new Date().toISOString().slice(0, 10));
  const [uploadFileType, setUploadFileType] = useState<'PDF' | 'XLSX' | 'XLS' | 'CSV' | 'URL'>('PDF');
  const [uploadExternalUrl, setUploadExternalUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const isSuperAdmin = currentUserRole === 'SUPER_ADMIN';

  const fetchDiaries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getContactDiaries({
        q: searchQuery.trim() || undefined,
        category: selectedCategory || undefined,
        districtId: selectedDistrict || undefined,
      });
      if (res.success && res.diaries) {
        setDiaries(res.diaries);
      } else {
        setDiaries([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load contact diaries.');
      setDiaries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiaries();
  }, [selectedCategory, selectedDistrict]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDiaries();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Auto-detect type
      const ext = file.name.split('.').pop()?.toUpperCase();
      if (ext === 'PDF') setUploadFileType('PDF');
      else if (ext === 'XLSX') setUploadFileType('XLSX');
      else if (ext === 'XLS') setUploadFileType('XLS');
      else if (ext === 'CSV') setUploadFileType('CSV');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!uploadTitle.trim() || uploadTitle.trim().length < 3) {
      setUploadError('Title must be at least 3 characters.');
      return;
    }

    let fileData: string | undefined = undefined;
    let fileName: string | undefined = undefined;
    let fileSize: number | undefined = undefined;

    if (uploadFileType === 'URL') {
      if (!uploadExternalUrl.startsWith('https://')) {
        setUploadError('External URL must be a valid secure HTTPS link (https://...).');
        return;
      }
    } else {
      if (!selectedFile) {
        setUploadError('Please select a file to upload.');
        return;
      }
      if (selectedFile.size > 25 * 1024 * 1024) {
        setUploadError('File exceeds maximum size of 25 MB.');
        return;
      }

      try {
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
        fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
      } catch (err) {
        setUploadError('Failed to read file contents.');
        return;
      }
    }

    setUploading(true);
    try {
      const res = await api.createContactDiary({
        title: uploadTitle.trim(),
        description: uploadDesc.trim() || undefined,
        category: uploadCategory,
        districtId: uploadDistrict || undefined,
        sourceDate: uploadSourceDate,
        fileType: uploadFileType,
        externalUrl: uploadFileType === 'URL' ? uploadExternalUrl.trim() : undefined,
        fileName,
        fileSize,
        fileData,
        mimeType: selectedFile?.type,
      });

      if (res.success) {
        setUploadSuccess('Contact diary published successfully.');
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadTitle('');
          setUploadDesc('');
          setSelectedFile(null);
          setUploadExternalUrl('');
          setUploadSuccess(null);
          fetchDiaries();
        }, 1200);
      } else {
        setUploadError(res.error || 'Failed to publish contact diary.');
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Server error uploading contact diary.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to remove the contact diary "${title}"?`)) {
      return;
    }
    try {
      const res = await api.deleteContactDiary(id);
      if (res.success) {
        fetchDiaries();
      } else {
        alert(res.error || 'Failed to delete contact diary.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to delete contact diary.');
    }
  };

  const handleDownload = (diary: Diary) => {
    if (diary.fileType === 'URL' && diary.externalUrl) {
      window.open(diary.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    // Direct API download
    const downloadUrl = `/api/diaries/${diary.id}/download`;
    window.open(downloadUrl, '_blank');
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'PDF':
        return <FileText className="h-5 w-5 text-red-500" />;
      case 'XLSX':
      case 'XLS':
      case 'CSV':
        return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
      default:
        return <ExternalLink className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-teal-600" />
              Contact Diaries & Resource Library
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Official district rosters, gazettes, phone directories and departmental guides
            </p>
          </div>

          {isSuperAdmin && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Plus className="h-4 w-4" />
              Upload Diary
            </button>
          )}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, description or district..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 dark:bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-teal-700 transition"
          >
            Search
          </button>
        </form>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              Category:
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-1.5 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white"
            >
              <option value="">All Categories</option>
              <option value="GENERAL">General Directory</option>
              <option value="DISTRICT">District Diary</option>
              <option value="HQ">Headquarters / Special Units</option>
              <option value="TRAFFIC">Traffic Police</option>
              <option value="EMERGENCY">Emergency Services (112)</option>
              <option value="CIRCULAR">Official Orders / Circulars</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              District:
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full py-1.5 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white"
            >
              <option value="">All Districts ({districts.length})</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="py-8 text-center text-sm text-slate-500 animate-pulse">
          Loading contact diaries...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && diaries.length === 0 && (
        <div className="py-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-500">
          <BookOpen className="h-10 w-10 mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No Contact Diaries Available</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {isSuperAdmin
              ? 'Click "Upload Diary" above to publish the first official PDF or Excel contact directory.'
              : 'Official contact diaries will appear here once published by the Super Admin.'}
          </p>
        </div>
      )}

      {/* Diary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {diaries.map((diary) => (
          <div
            key={diary.id}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-700 shrink-0">
                  {getFileIcon(diary.fileType)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm leading-snug line-clamp-2">
                    {diary.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-1.5 py-0.5 rounded">
                      {diary.category}
                    </span>
                    {diary.districtName && (
                      <span className="inline-flex items-center gap-0.5 text-slate-600 dark:text-slate-300">
                        <Building2 className="h-3 w-3" />
                        {diary.districtName}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-0.5">
                      <Calendar className="h-3 w-3" />
                      {diary.sourceDate}
                    </span>
                  </div>
                </div>
              </div>

              {diary.description && (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                  {diary.description}
                </p>
              )}
            </div>

            {/* Actions Bar */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">
                {diary.fileType === 'URL' ? (
                  <span className="text-blue-500 font-medium">Verified HTTPS Link</span>
                ) : (
                  <span>
                    {diary.fileType} • {formatFileSize(diary.fileSize)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isSuperAdmin && (
                  <button
                    onClick={() => handleDelete(diary.id, diary.title)}
                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
                    title="Delete Diary"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}

                <button
                  onClick={() => handleDownload(diary)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 dark:hover:bg-teal-700 transition"
                >
                  {diary.fileType === 'URL' ? (
                    <>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Super Admin Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-teal-600" />
                Upload Contact Diary / Resource
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4">
              {uploadError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {uploadSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Diary Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lucknow District Police Directory 2026"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Updated list of officers, contact numbers and police stations as of Oct 2026"
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="GENERAL">General Directory</option>
                    <option value="DISTRICT">District Diary</option>
                    <option value="HQ">Headquarters / Units</option>
                    <option value="TRAFFIC">Traffic Police</option>
                    <option value="EMERGENCY">Emergency (112)</option>
                    <option value="CIRCULAR">Orders / Circulars</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    District Scope
                  </label>
                  <select
                    value={uploadDistrict}
                    onChange={(e) => setUploadDistrict(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="">Statewide / All Districts</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Resource Type *
                  </label>
                  <select
                    value={uploadFileType}
                    onChange={(e) => setUploadFileType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="PDF">PDF Document (.pdf)</option>
                    <option value="XLSX">Excel Spreadsheet (.xlsx)</option>
                    <option value="XLS">Excel 97-2003 (.xls)</option>
                    <option value="CSV">CSV Table (.csv)</option>
                    <option value="URL">External HTTPS Web Link</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Source Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={uploadSourceDate}
                    onChange={(e) => setUploadSourceDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {uploadFileType === 'URL' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Verified HTTPS URL *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://uppolice.gov.in/..."
                    value={uploadExternalUrl}
                    onChange={(e) => setUploadExternalUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Select File ({uploadFileType}) *
                  </label>
                  <input
                    type="file"
                    required
                    accept={
                      uploadFileType === 'PDF'
                        ? '.pdf,application/pdf'
                        : uploadFileType === 'XLSX'
                        ? '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                        : uploadFileType === 'XLS'
                        ? '.xls,application/vnd.ms-excel'
                        : '.csv,text/csv'
                    }
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white file:mr-3 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 dark:file:bg-teal-900/40 dark:file:text-teal-300"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Maximum file size: 25 MB</p>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Publish Diary'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
