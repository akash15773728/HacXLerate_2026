import { useState, useEffect } from 'react';
import { AlertCircle, Check, Copy, Cpu, Download, ExternalLink, Fingerprint, Globe2, HeartPulse, Key, LoaderCircle, LockKeyhole, Phone, Plus, RefreshCw, Save, Sparkles, Unplug, X } from 'lucide-react';
import type { Bootstrap, Language, Patient } from '../../shared/types';
import { api } from '../api';
import { Badge } from '../components/ui';

interface Props {
  data: Bootstrap;
  language: Language;
  onRefresh: () => Promise<void>;
  notify: (msg: string) => void;
}

export default function Profile({ data, language, onRefresh, notify }: Props) {
  const [draft, setDraft] = useState(data.patient);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [allergyInput, setAllergyInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [aiConfig, setAiConfig] = useState<{ geminiConfigured: boolean; nvidiaConfigured: boolean; preferredProvider: string }>({
    geminiConfigured: false,
    nvidiaConfigured: false,
    preferredProvider: 'gemini',
  });
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [savingAi, setSavingAi] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);

  useEffect(() => {
    api.getAiConfig().then(setAiConfig).catch(() => {});
  }, []);

  const t = (en: string, hi: string) => (language === 'hi' ? hi : en);

  async function handleSaveAiProvider(provider?: string) {
    setSavingAi(true);
    try {
      const res = await api.configureAi({
        geminiApiKey: geminiKeyInput.trim() || undefined,
        preferredProvider: provider || aiConfig.preferredProvider,
      });
      setAiConfig(res);
      if (geminiKeyInput.trim()) {
        setGeminiKeyInput('');
        setShowKeyInput(false);
      }
      notify(t('AI OCR settings updated successfully!', 'AI OCR सेटिंग्स सफलतापूर्वक अपडेट की गईं!'));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSavingAi(false);
    }
  }

  const commonAllergies = ['Penicillin', 'Sulfa drugs', 'Aspirin', 'Peanuts', 'Pollen / Dust'];
  const commonConditions = ['Pre-diabetes', 'Hypertension', 'Vitamin D deficiency', 'Asthma', 'High Cholesterol'];

  async function save(values: Partial<Patient>) {
    setBusy(true);
    setError('');
    try {
      const p = await api.patient(values);
      setDraft(p);
      await onRefresh();
      notify(t('Your unified health profile has been saved successfully.', 'आपकी एकीकृत स्वास्थ्य प्रोफ़ाइल सफलतापूर्वक सहेज ली गई है।'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAbhaImport() {
    setImporting(true);
    setError('');
    try {
      const result = await api.importAbha();
      await onRefresh();
      notify(t(`Imported ${result.importedCount} verified records via ABDM network from Max Hospital & Dr. Lal PathLabs!`, `ABDM नेटवर्क से मैक्स हॉस्पिटल और डॉ लाल पाथलैब्स से ${result.importedCount} रिकॉर्ड इम्पोर्ट किए गए!`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  function copyAbhaId() {
    if (draft.abhaId) {
      navigator.clipboard.writeText(draft.abhaId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      notify(t('ABHA ID copied to clipboard!', 'ABHA आईडी क्लिपबोर्ड पर कॉपी हो गई!'));
    }
  }

  function addAllergy(name: string) {
    const trimmed = name.trim();
    if (!trimmed || draft.allergies.includes(trimmed)) return;
    setDraft({ ...draft, allergies: [...draft.allergies, trimmed] });
    setAllergyInput('');
  }

  function removeAllergy(name: string) {
    setDraft({ ...draft, allergies: draft.allergies.filter(a => a !== name) });
  }

  function addCondition(name: string) {
    const trimmed = name.trim();
    const current = draft.conditions || [];
    if (!trimmed || current.includes(trimmed)) return;
    setDraft({ ...draft, conditions: [...current, trimmed] });
    setConditionInput('');
  }

  function removeCondition(name: string) {
    const current = draft.conditions || [];
    setDraft({ ...draft, conditions: current.filter(c => c !== name) });
  }

  // Calculate age helper
  const birthYear = draft.dateOfBirth ? new Date(draft.dateOfBirth).getFullYear() : null;
  const currentYear = new Date().getFullYear();
  const calculatedAge = birthYear ? `${currentYear - birthYear} ${t('years old', 'वर्ष')}` : null;

  return (
    <div className="page-enter profile-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t('UNIFIED HEALTH PASSPORT & IDENTITY', 'एकीकृत स्वास्थ्य पासपोर्ट और पहचान')}</div>
          <h1>{t('Your Personal Health Profile', 'आपकी व्यक्तिगत स्वास्थ्य प्रोफ़ाइल')}</h1>
          <p>{t('Organize your medical demographics, ABHA digital identity, allergies, and emergency contacts in one simple, unified place.', 'अपने मेडिकल विवरण, ABHA पहचान, एलर्जी और आपातकालीन संपर्क एक जगह व्यवस्थित रखें।')}</p>
        </div>
      </div>

      <div className="profile-grid">
        {/* Left Column: Demographics & Clinical Passport */}
        <section className="panel profile-form" style={{ padding: '24px' }}>
          <div className="section-heading" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span className="profile-avatar" style={{ width: '48px', height: '48px', fontSize: '18px', background: '#254e3f', color: '#fff' }}>
                {draft.name.split(' ').map(s => s[0]).slice(0, 2).join('')}
              </span>
              <div>
                <h2 style={{ fontSize: '19px', margin: 0 }}>{t('Personal Demographics', 'व्यक्तिगत जानकारी')}</h2>
                <p style={{ margin: '3px 0 0', fontSize: '13px' }}>
                  {calculatedAge ? `${calculatedAge} · ${draft.gender.toUpperCase()} · ${draft.bloodGroup}` : t('Patient essentials', 'मरीज की बुनियादी जानकारी')}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={e => {
            e.preventDefault();
            void save({
              name: draft.name,
              dateOfBirth: draft.dateOfBirth,
              gender: draft.gender,
              bloodGroup: draft.bloodGroup,
              allergies: draft.allergies,
              abhaAddress: draft.abhaAddress,
              conditions: draft.conditions,
              emergencyContact: draft.emergencyContact,
            });
          }}>
            <div className="form-grid">
              <label>
                {t('Full Name', 'पूरा नाम')}
                <input required value={draft.name} maxLength={100} onChange={e => setDraft({ ...draft, name: e.target.value })} />
              </label>

              <label>
                {t('Date of Birth', 'जन्म तारीख')}
                <input type="date" required value={draft.dateOfBirth} max="2026-10-13" onChange={e => setDraft({ ...draft, dateOfBirth: e.target.value })} />
              </label>

              <label>
                {t('Gender', 'लिंग')}
                <select value={draft.gender} onChange={e => setDraft({ ...draft, gender: e.target.value })}>
                  {['male', 'female', 'other', 'unknown'].map(s => (
                    <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </label>

              <label>
                {t('Blood Group', 'ब्लड ग्रुप')}
                <select value={draft.bloodGroup} onChange={e => setDraft({ ...draft, bloodGroup: e.target.value })}>
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              {/* Allergies section with friendly tag pills */}
              <div className="full-width" style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ margin: 0, fontWeight: '600', color: '#183f33' }}>
                    {t('Clinical Allergies', 'एलर्जी और दवा संवेदनशीलता')}
                  </label>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {draft.allergies.length} {t('recorded', 'दर्ज')}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '36px', padding: '10px', background: '#fcfcfb', border: '1px solid #dcded8', borderRadius: '8px', marginBottom: '8px' }}>
                  {draft.allergies.map(allergy => (
                    <span key={allergy} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#feeae8', color: '#9c2f25', borderRadius: '16px', fontSize: '13px', fontWeight: '500' }}>
                      <AlertCircle size={13} /> {allergy}
                      <button type="button" onClick={() => removeAllergy(allergy)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#9c2f25' }} aria-label={`Remove ${allergy}`}>
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                  {!draft.allergies.length && (
                    <span style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
                      {t('No active allergies recorded. Click a common allergy below or type to add.', 'कोई एलर्जी दर्ज नहीं है। नीचे दिए गए विकल्पों पर क्लिक करें या टाइप करें।')}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder={t('Type allergy (e.g., Penicillin, Peanuts)…', 'एलर्जी का नाम लिखें (जैसे पेनिसिलिन)…')}
                    value={allergyInput}
                    onChange={e => setAllergyInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAllergy(allergyInput); } }}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="button secondary" onClick={() => addAllergy(allergyInput)}>
                    <Plus size={15} /> {t('Add', 'जोड़ें')}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{t('Quick add:', 'जल्दी जोड़ें:')}</span>
                  {commonAllergies.map(item => (
                    <button
                      key={item}
                      type="button"
                      disabled={draft.allergies.includes(item)}
                      onClick={() => addAllergy(item)}
                      style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '12px', border: '1px solid #d5ddd5', background: draft.allergies.includes(item) ? '#eef2ee' : '#fff', cursor: draft.allergies.includes(item) ? 'default' : 'pointer' }}
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chronic Conditions / Focus Section */}
              <div className="full-width" style={{ marginTop: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ margin: 0, fontWeight: '600', color: '#183f33' }}>
                    {t('Chronic Health Conditions & Monitoring Focus', 'पुरानी स्थितियाँ और स्वास्थ्य निगरानी')}
                  </label>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {(draft.conditions || []).length} {t('tracked', 'ट्रैक की जा रही')}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '36px', padding: '10px', background: '#fcfcfb', border: '1px solid #dcded8', borderRadius: '8px', marginBottom: '8px' }}>
                  {(draft.conditions || []).map(condition => (
                    <span key={condition} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#edf5ee', color: '#1f533a', borderRadius: '16px', fontSize: '13px', fontWeight: '500' }}>
                      <HeartPulse size={13} /> {condition}
                      <button type="button" onClick={() => removeCondition(condition)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1f533a' }} aria-label={`Remove ${condition}`}>
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                  {!(draft.conditions || []).length && (
                    <span style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
                      {t('No chronic conditions listed. Add one below to track trends in your timeline.', 'कोई पुरानी स्थिति दर्ज नहीं है। नीचे से चुनें या टाइप करें।')}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder={t('Type health focus (e.g., Pre-diabetes, Hypertension)…', 'स्थिति लिखें (जैसे प्रीडायबिटीज)…')}
                    value={conditionInput}
                    onChange={e => setConditionInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCondition(conditionInput); } }}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="button secondary" onClick={() => addCondition(conditionInput)}>
                    <Plus size={15} /> {t('Add', 'जोड़ें')}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{t('Quick add:', 'जल्दी जोड़ें:')}</span>
                  {commonConditions.map(item => (
                    <button
                      key={item}
                      type="button"
                      disabled={(draft.conditions || []).includes(item)}
                      onClick={() => addCondition(item)}
                      style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '12px', border: '1px solid #d5ddd5', background: (draft.conditions || []).includes(item) ? '#eef2ee' : '#fff', cursor: (draft.conditions || []).includes(item) ? 'default' : 'pointer' }}
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* ICE - In Case of Emergency Card */}
              <div className="full-width" style={{ marginTop: '16px', padding: '16px', background: '#fdfbfa', border: '1px solid #eddcd7', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Phone size={17} color="#a63d2e" />
                  <strong style={{ fontSize: '15px', color: '#682015' }}>
                    {t('ICE: In Case of Emergency Contact', 'आपातकालीन संपर्क (ICE)')}
                  </strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ margin: 0 }}>
                    {t('Emergency Contact Name', 'संपर्क व्यक्ति का नाम')}
                    <input
                      value={draft.emergencyContact?.name || ''}
                      placeholder="e.g. Priya Sharma"
                      onChange={e => setDraft({ ...draft, emergencyContact: { ...(draft.emergencyContact || { name: '', phone: '', relation: '' }), name: e.target.value } })}
                    />
                  </label>
                  <label style={{ margin: 0 }}>
                    {t('Emergency Phone Number', 'आपातकालीन फ़ोन नंबर')}
                    <input
                      value={draft.emergencyContact?.phone || ''}
                      placeholder="+91 98765 43210"
                      onChange={e => setDraft({ ...draft, emergencyContact: { ...(draft.emergencyContact || { name: '', phone: '', relation: '' }), phone: e.target.value } })}
                    />
                  </label>
                </div>
              </div>
            </div>

            {error && <div className="error-message" role="alert" style={{ marginTop: '14px' }}>{error}</div>}

            <div style={{ marginTop: '20px' }}>
              <button className="button primary" disabled={busy} type="submit" style={{ padding: '10px 22px' }}>
                {busy ? <LoaderCircle size={16} className="spinner" /> : <Save size={16} />}
                {t('Save Profile Changes', 'प्रोफ़ाइल सहेजें')}
              </button>
            </div>
          </form>
        </section>

        {/* Right Column: ABDM Digital Health Identity & Interoperability */}
        <div className="profile-side">
          {/* Authentic-styled ABHA Card */}
          <section className="panel" style={{ padding: '22px', background: 'linear-gradient(135deg, #183f33 0%, #1f5041 100%)', color: '#fff', borderRadius: '14px', boxShadow: '0 8px 24px rgba(24,63,51,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '12px', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, display: 'block' }}>
                  {t('NATIONAL HEALTH AUTHORITY · ABDM', 'राष्ट्रीय स्वास्थ्य प्राधिकरण · ABDM')}
                </span>
                <strong style={{ fontSize: '16px', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <Fingerprint size={18} /> {t('Ayushman Bharat Health Account', 'आयुष्मान भारत स्वास्थ्य खाता')}
                </strong>
              </div>
              <Badge tone={draft.abhaLinked ? 'green' : 'amber'}>
                {draft.abhaLinked ? t('VERIFIED', 'सत्यापित') : t('NOT LINKED', 'जुड़ा नहीं है')}
              </Badge>
            </div>

            {/* ABHA Details Container */}
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px', marginBottom: '16px', backdropFilter: 'blur(4px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', opacity: 0.75, display: 'block', textTransform: 'uppercase' }}>
                    {t('ABHA Number', 'ABHA नंबर')}
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: '700', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                    {draft.abhaId || '91-2345-6789-0123'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copyAbhaId}
                  className="icon-button"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer' }}
                  title={t('Copy ABHA ID', 'कॉपी करें')}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <div>
                  <span style={{ opacity: 0.75, fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                    {t('ABHA PHR Address', 'ABHA पता')}
                  </span>
                  <code style={{ fontSize: '13px', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                    {draft.abhaAddress || 'aarav.sharma@abdm'}
                  </code>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ opacity: 0.75, fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                    {t('Status', 'स्थिति')}
                  </span>
                  <span style={{ color: '#68e2a3', fontWeight: '600' }}>
                    {draft.abhaLinked ? t('Active', 'सक्रिय') : t('Inactive', 'निष्क्रिय')}
                  </span>
                </div>
              </div>
            </div>

            {/* ABDM Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {draft.abhaLinked && (
                <button
                  type="button"
                  className="button primary full-width"
                  disabled={busy || importing}
                  onClick={handleAbhaImport}
                  style={{ background: '#257053', color: '#fff', border: 'none', fontWeight: '600' }}
                >
                  {importing ? <LoaderCircle size={16} className="spinner" /> : <RefreshCw size={16} />}
                  {importing ? t('Syncing Linked Records…', 'रिकॉर्ड सिंक हो रहे हैं…') : t('Sync Hospital & Lab Records', 'अस्पताल व लैब रिकॉर्ड सिंक करें')}
                </button>
              )}

              <button
                type="button"
                className="button secondary full-width"
                disabled={busy || importing}
                onClick={() => save({
                  abhaLinked: !draft.abhaLinked,
                  abhaId: draft.abhaLinked ? null : '91-2345-6789-0123',
                  abhaAddress: draft.abhaLinked ? null : 'aarav.sharma@abdm',
                })}
                style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}
              >
                {draft.abhaLinked ? <Unplug size={16} /> : <Fingerprint size={16} />}
                {draft.abhaLinked ? t('Disconnect ABHA Account', 'ABHA खाता हटाएं') : t('Connect Mock ABHA ID', 'मॉक ABHA आईडी जोड़ें')}
              </button>
            </div>
          </section>

          {/* AI OCR Engine & Handwriting Recognition */}
          <section className="panel" style={{ padding: '20px', border: '1px solid #dce8d2' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <Sparkles size={20} color="#2b5e43" />
                <h3 style={{ margin: 0, fontSize: '16px' }}>
                  {t('Handwritten Prescription OCR Engine', 'हस्तलिखित पर्चा OCR इंजन')}
                </h3>
              </div>
              <Badge tone={aiConfig.geminiConfigured ? 'green' : 'amber'}>
                {aiConfig.geminiConfigured ? t('GEMINI FLASH ACTIVE', 'जेमिनी सक्रिय') : t('NVIDIA FALLBACK', 'NVIDIA फॉलबैक')}
              </Badge>
            </div>

            <p style={{ fontSize: '12px', margin: '0 0 14px', lineHeight: '1.6', color: '#5f6f59' }}>
              {t(
                'Doctor handwritten prescriptions require high-resolution multimodal vision to decipher cursive handwriting and Latin abbreviations (OD, BD, TDS, SOS). Google Gemini 1.5 Flash offers 1,500 free daily requests without needing a credit card.',
                'डॉक्टरों के हस्तलिखित पर्चों को समझने के लिए विशेष विज़न मॉडल की आवश्यकता होती है। Google Gemini 1.5 Flash बिना क्रेडिट कार्ड के प्रतिदिन 1,500 फ्री अनुरोध प्रदान करता है।'
              )}
            </p>

            {/* Provider Switcher */}
            <div style={{ background: '#f5f8f1', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#44573d', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('Active OCR Provider', 'सक्रिय OCR प्रदाता')}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className={`button secondary ${aiConfig.preferredProvider === 'gemini' ? 'selected' : ''}`}
                  onClick={() => handleSaveAiProvider('gemini')}
                  disabled={savingAi}
                  style={{
                    flex: 1,
                    fontSize: '11px',
                    padding: '8px 10px',
                    borderColor: aiConfig.preferredProvider === 'gemini' ? '#254e3f' : '#dfe5d7',
                    background: aiConfig.preferredProvider === 'gemini' ? '#e2ebd6' : '#fff',
                    fontWeight: aiConfig.preferredProvider === 'gemini' ? '600' : 'normal',
                  }}
                >
                  <Sparkles size={14} color="#254e3f" />
                  {t('Gemini 1.5 Flash', 'जेमिनी 1.5 फ़्लैश')}
                </button>
                <button
                  type="button"
                  className={`button secondary ${aiConfig.preferredProvider === 'nvidia' ? 'selected' : ''}`}
                  onClick={() => handleSaveAiProvider('nvidia')}
                  disabled={savingAi}
                  style={{
                    flex: 1,
                    fontSize: '11px',
                    padding: '8px 10px',
                    borderColor: aiConfig.preferredProvider === 'nvidia' ? '#254e3f' : '#dfe5d7',
                    background: aiConfig.preferredProvider === 'nvidia' ? '#e2ebd6' : '#fff',
                    fontWeight: aiConfig.preferredProvider === 'nvidia' ? '600' : 'normal',
                  }}
                >
                  <Cpu size={14} color="#76b900" />
                  {t('NVIDIA Llama 3.2', 'NVIDIA लामा 3.2')}
                </button>
              </div>
            </div>

            {/* Gemini API Key Management */}
            <div style={{ borderTop: '1px solid #eef2e7', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#45593e' }}>
                  {t('Google Gemini 1.5 Flash (Free Tier)', 'गूगल जेमिनी 1.5 फ़्लैश (मुफ़्त टियर)')}
                </span>
                <span style={{ fontSize: '11px', color: aiConfig.geminiConfigured ? '#2d6d4b' : '#b27a24', fontWeight: '500' }}>
                  {aiConfig.geminiConfigured ? t('✓ Key Configured', '✓ कुंजी सक्रिय') : t('⚠ Using fallback', '⚠ फॉलबैक सक्रिय')}
                </span>
              </div>

              {!showKeyInput && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setShowKeyInput(true)}
                  style={{ fontSize: '11px', color: '#254e3f', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}
                >
                  <Key size={13} />
                  {aiConfig.geminiConfigured ? t('Update Gemini API Key', 'जेमिनी API कुंजी बदलें') : t('Add Free Gemini API Key for Handwriting', 'हस्तलेखन हेतु मुफ़्त जेमिनी कुंजी जोड़ें')}
                </button>
              )}

              {showKeyInput && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={geminiKeyInput}
                    onChange={e => setGeminiKeyInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #ccd8c2',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="button primary"
                      disabled={savingAi || !geminiKeyInput.trim()}
                      onClick={() => handleSaveAiProvider()}
                      style={{ fontSize: '11px', padding: '6px 14px' }}
                    >
                      {savingAi ? <LoaderCircle size={14} className="spinner" /> : <Save size={14} />}
                      {t('Save Key', 'कुंजी सहेजें')}
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => { setShowKeyInput(false); setGeminiKeyInput(''); }}
                      style={{ fontSize: '11px', padding: '6px 12px' }}
                    >
                      {t('Cancel', 'रद्द करें')}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '8px' }}>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: '#2a5e44',
                    textDecoration: 'underline',
                  }}
                >
                  {t('Get free Gemini API key from Google AI Studio (No credit card needed)', 'Google AI Studio से मुफ़्त कुंजी प्राप्त करें (क्रेडिट कार्ड की आवश्यकता नहीं)')}
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>
          </section>

          {/* Interoperability & Data Portability */}
          <section className="panel export-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Globe2 size={22} color="#183f33" />
              <h3 style={{ margin: 0, fontSize: '16px' }}>
                {t('FHIR R4 Standard Data Export', 'FHIR R4 डेटा एक्सपोर्ट')}
              </h3>
            </div>
            <p style={{ fontSize: '13px', margin: '0 0 14px' }}>
              {t('Download your entire clinical history and profile as an ABDM-compliant HL7 FHIR R4 standard JSON bundle for portability across healthcare providers.', 'डॉक्टर या अन्य अस्पताल के साथ साझा करने के लिए आधिकारिक FHIR R4 डेटा फ़ाइल डाउनलोड करें।')}
            </p>
            <a
              className="button secondary"
              href="/api/export/fhir"
              download="sehat-health-records.fhir.json"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <Download size={15} />
              {t('Download FHIR R4 Bundle', 'FHIR R4 बंडल डाउनलोड करें')}
              <ExternalLink size={12} />
            </a>
          </section>

          {/* Privacy & Safety Note */}
          <section className="privacy-panel" style={{ padding: '16px' }}>
            <LockKeyhole size={20} />
            <div>
              <h3 style={{ fontSize: '14px', margin: 0 }}>
                {t('Local Storage & Complete Privacy', 'स्थानीय स्टोरेज और पूरी गोपनीयता')}
              </h3>
              <p style={{ fontSize: '12px', margin: '4px 0 0' }}>
                {t('Your records reside locally on your device in SQLite. Private AI transcription and extraction run only after your consent.', 'आपका डेटा आपके डिवाइस पर सुरक्षित है। AI प्रोसेसिंग केवल आपकी सहमति पर होती है।')}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
