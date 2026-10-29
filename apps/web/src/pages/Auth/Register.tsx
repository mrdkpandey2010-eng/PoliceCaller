import React, { useState, useEffect } from 'react';
import { Button, Input, Card } from '@police-directory/ui';
import { Shield, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { RegisterSchema } from '@police-directory/shared';

export interface RegisterProps {
  onNavigateToLogin: () => void;
  initialIdentifier?: string;
}

export const Register: React.FC<RegisterProps> = ({ onNavigateToLogin, initialIdentifier }) => {
  const { register } = useAuth();
  const { language } = useLanguage();

  const [districts, setDistricts] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    pno: initialIdentifier && initialIdentifier.length !== 10 ? initialIdentifier : '',
    fullName: '',
    designationId: '',
    districtId: '',
    stationOfficeId: '',
    mobile: initialIdentifier && initialIdentifier.length === 10 ? initialIdentifier : '',
    whatsapp: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    if (initialIdentifier) {
      if (initialIdentifier.length === 10) {
        setFormData((prev) => ({ ...prev, mobile: initialIdentifier }));
      } else {
        setFormData((prev) => ({ ...prev, pno: initialIdentifier }));
      }
    }
  }, [initialIdentifier]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load verified masters on mount
  useEffect(() => {
    api.getDistricts().then((res) => setDistricts(res.districts || []));
    api.getDesignations().then((res) => setDesignations(res.designations || []));
  }, []);

  // Cascading station list when district changes
  useEffect(() => {
    if (formData.districtId) {
      api.getStations(formData.districtId).then((res) => {
        setStations(res.stations || []);
        setFormData((prev) => ({ ...prev, stationOfficeId: '' }));
      });
    } else {
      setStations([]);
    }
  }, [formData.districtId]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    // Client-side Zod validation with strict English-only rules
    const validationResult = RegisterSchema.safeParse(formData);
    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      validationResult.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        errors[path] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await register(validationResult.data);
      setSuccessMessage(res.message);
    } catch (err: any) {
      setGeneralError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (successMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {language === 'hi' ? 'पंजीकरण अनुरोध प्राप्त हुआ' : 'Registration Submitted'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {successMessage}
          </p>
          <Button
            variant="primary"
            onClick={onNavigateToLogin}
            aria-label="Return to Login page"
            className="w-full mt-4 font-bold"
          >
            {language === 'hi' ? 'लॉग इन पृष्ठ पर जाएं' : 'Proceed to Login'}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 flex items-center justify-center bg-slate-100 dark:bg-slate-950">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onNavigateToLogin}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {language === 'hi' ? 'लॉग इन पर वापस' : 'Back to Login'}
          </button>
          <span className="text-[11px] font-bold text-[#147D84] bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-full">
            Canonical English Data
          </span>
        </div>

        <Card className="p-6 sm:p-8 shadow-xl rounded-3xl">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-[#17324F] flex items-center justify-center text-[#C3A35E]">
              <Shield className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {language === 'hi' ? 'कार्मिक स्व-पंजीकरण' : 'Personnel Self-Registration'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Uttar Pradesh Police Department
              </p>
            </div>
          </div>

          {generalError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Personnel Number (PNO)"
                value={formData.pno}
                onChange={(e) => handleChange('pno', e.target.value)}
                placeholder="e.g. 00123456"
                error={fieldErrors.pno}
                englishOnlyNotice
                required
              />

              <Input
                label="Full Name (in English)"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                error={fieldErrors.fullName}
                englishOnlyNotice
                required
              />
            </div>

            {/* Cascading Masters Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Designation / Rank
                </label>
                <select
                  value={formData.designationId}
                  onChange={(e) => handleChange('designationId', e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#17324F]"
                  required
                >
                  <option value="">Select Rank</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.shortName} - {d.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.designationId && (
                  <p className="mt-1 text-[11px] text-red-500 font-medium">
                    {fieldErrors.designationId}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  District (75 Official)
                </label>
                <select
                  value={formData.districtId}
                  onChange={(e) => handleChange('districtId', e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#17324F]"
                  required
                >
                  <option value="">Select District</option>
                  {districts.map((dist) => (
                    <option key={dist.id} value={dist.id}>
                      {dist.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.districtId && (
                  <p className="mt-1 text-[11px] text-red-500 font-medium">
                    {fieldErrors.districtId}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Station / Office
                </label>
                <select
                  value={formData.stationOfficeId}
                  onChange={(e) => handleChange('stationOfficeId', e.target.value)}
                  disabled={!formData.districtId}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#17324F] disabled:opacity-50"
                  required
                >
                  <option value="">
                    {formData.districtId ? 'Select Station/Office' : 'Choose District first'}
                  </option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.stationOfficeId && (
                  <p className="mt-1 text-[11px] text-red-500 font-medium">
                    {fieldErrors.stationOfficeId}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Mobile Number (10 Digits)"
                value={formData.mobile}
                onChange={(e) => handleChange('mobile', e.target.value)}
                placeholder="e.g. 9876543210"
                error={fieldErrors.mobile}
                maxLength={10}
                required
              />

              <Input
                label="WhatsApp Number (Optional)"
                value={formData.whatsapp}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                placeholder="e.g. 9876543210"
                error={fieldErrors.whatsapp}
                maxLength={10}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Official Email (Optional)"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="name@uppolice.gov.in"
                error={fieldErrors.email}
              />

              <Input
                label="Create Password (Min 8 Chars)"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="••••••••"
                error={fieldErrors.password}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              aria-label="Submit registration request"
              className="w-full mt-3 font-bold bg-[#17324F] hover:bg-[#10243B] text-white shadow-md rounded-xl"
            >
              {language === 'hi' ? 'पंजीकरण जमा करें' : 'Submit Registration for Approval'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
