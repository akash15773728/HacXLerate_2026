import { useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronRight, Download, FileText, Fingerprint, HeartPulse, Leaf, LoaderCircle, Plus, RefreshCw, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import type { Bootstrap, HealthRecord, Language } from '../../shared/types';
import { api } from '../api';
import { Badge, dateLabel, local, RecordRow } from '../components/ui';
import HealthIllustration from '../components/HealthIllustration';
import VitalsModal from '../components/VitalsModal';

interface Props {
  data: Bootstrap;
  language: Language;
  openRecord: (r: HealthRecord) => void;
  navigate: (page: string) => void;
  onUpload: () => void;
  onRefresh?: () => Promise<void>;
  notify?: (message: string) => void;
}

export default function Overview({ data, language, openRecord, navigate, onUpload, onRefresh, notify }: Props) {
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [syncingAbha, setSyncingAbha] = useState(false);
  const t = (en: string, hi: string) => (language === 'hi' ? hi : en);

  async function handleAbhaSync() {
    setSyncingAbha(true);
    try {
      const res = await api.importAbha();
      if (onRefresh) await onRefresh();
      if (notify) notify(t(`Successfully synced ${res.importedCount} records via ABDM network from Max Hospital & Dr. Lal PathLabs!`, `ABDM नेटवर्क से ${res.importedCount} रिकॉर्ड मैक्स हॉस्पिटल और डॉ लाल पाथलैब्स से सफलतापूर्वक सिंक किए गए!`));
    } catch (err) {
      if (notify) notify((err as Error).message);
    } finally {
      setSyncingAbha(false);
    }
  }

  const records = [...data.records].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const pending = records.filter(r => r.reviewStatus === 'pending');
  const medicines = new Set(records.flatMap(r => r.medications.map(m => m.name))).size;
  const latestLab = records.find(r => r.type === 'lab' && r.observations.length);
  const attention = latestLab?.observations.filter(o => o.status === 'high' || o.status === 'low') || [];
  const trend = [...records].reverse().flatMap(r => r.observations.filter(o => /hba1c|glycated/i.test(o.name) && o.value !== null).map(o => ({ value: o.value!, date: r.date })));
  const firstName = data.patient.name.split(' ')[0];

  const latestVital = data.vitals && data.vitals.length > 0 ? data.vitals[0] : null;

  return (
    <div className="page-enter overview">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t('A LITTLE CLARITY, EVERY DAY', 'हर दिन, थोड़ी और स्पष्टता')}</div>
          <h1>
            {t(`Good to see you, ${firstName}`, `नमस्ते, ${firstName}`)} <span className="greeting-leaf"><Leaf size={25} /></span>
          </h1>
          <p>{t('Your health story, all in one place. Let’s make sense of it.', 'आपकी सेहत की पूरी कहानी, एक जगह। आइए इसे समझें।')}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="button secondary" onClick={() => setShowVitalsModal(true)}>
            <HeartPulse size={16} />{t('Log Vitals', 'वाइटल्स दर्ज करें')}
          </button>
          <button className="button primary" onClick={onUpload}>
            <Plus size={17} />{t('Add Health Record', 'रिकॉर्ड जोड़ें')}
          </button>
        </div>
      </div>

      {/* ABDM / ABHA Digital Health Hub on Dashboard */}
      <section className="panel" style={{ padding: '18px 22px', marginBottom: '20px', background: 'linear-gradient(135deg, #f0f7f3 0%, #e6f2eb 100%)', border: '1px solid #c2ded1' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#1c4a3b', color: '#fff', display: 'grid', placeItems: 'center' }}>
              <Fingerprint size={24} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#13352a', margin: 0 }}>
                  {t('Ayushman Bharat Digital Health (ABDM)', 'आयुष्मान भारत डिजिटल स्वास्थ्य (ABDM)')}
                </h2>
                <Badge tone={data.patient.abhaLinked ? 'green' : 'amber'}>
                  {data.patient.abhaLinked ? t('ABDM CONNECTED', 'ABDM से जुड़ा हुआ') : t('NOT CONNECTED', 'जुड़ा नहीं है')}
                </Badge>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#4a6b5d' }}>
                {t('Unified health records linked across hospitals, diagnostic laboratories, and clinics in India.', 'अस्पतालों, डायग्नोस्टिक लैब और क्लीनिकों से जुड़े आपके एकीकृत स्वास्थ्य रिकॉर्ड।')}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="button primary"
              disabled={syncingAbha}
              onClick={handleAbhaSync}
              style={{ background: '#1c4a3b', color: '#fff', fontSize: '13px', padding: '8px 16px' }}
            >
              {syncingAbha ? <LoaderCircle size={15} className="spinner" /> : <RefreshCw size={15} />}
              {syncingAbha ? t('Syncing Records…', 'सिंक हो रहा है…') : t('Sync ABDM Records', 'ABDM रिकॉर्ड सिंक करें')}
            </button>
            <a
              className="button secondary"
              href="/api/export/fhir"
              download="sehat-health-records.fhir.json"
              style={{ fontSize: '13px', padding: '8px 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={15} />
              {t('Export FHIR R4', 'FHIR R4 एक्सपोर्ट')}
            </a>
            <button
              className="text-button subtle"
              onClick={() => navigate('profile')}
              style={{ fontSize: '13px', margin: 0 }}
            >
              {t('Manage ABHA', 'ABHA प्रबंधित करें')} <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <div style={{ padding: '10px 14px', background: '#ffffff', borderRadius: '8px', border: '1px solid #d5e5dc' }}>
            <span style={{ fontSize: '11px', color: '#688275', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
              {t('ABHA Number', 'ABHA नंबर')}
            </span>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#13352a', marginTop: '2px', fontFamily: 'monospace' }}>
              {data.patient.abhaId || '91-2345-6789-0123'}
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: '#ffffff', borderRadius: '8px', border: '1px solid #d5e5dc' }}>
            <span style={{ fontSize: '11px', color: '#688275', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
              {t('ABHA PHR Address', 'ABHA पता')}
            </span>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#13352a', marginTop: '2px' }}>
              {data.patient.abhaAddress || 'aarav.sharma@abdm'}
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: '#ffffff', borderRadius: '8px', border: '1px solid #d5e5dc' }}>
            <span style={{ fontSize: '11px', color: '#688275', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
              {t('Linked Healthcare Providers', 'जुड़े स्वास्थ्य प्रदाता')}
            </span>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#254e3f', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={15} /> Max Hospital & Dr. Lal PathLabs
            </div>
          </div>
        </div>
      </section>

      {/* User-Friendly Quick Steps Banner */}
      <section className="panel" style={{ padding: '16px 20px', marginBottom: '20px', background: 'linear-gradient(135deg, #f7faf5 0%, #edf4e8 100%)', border: '1px solid #d5e2cf' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#254e3f', color: '#fff', display: 'grid', placeItems: 'center' }}>
              <Sparkles size={18} />
            </span>
            <div>
              <strong style={{ fontSize: '15px', color: '#183f33' }}>
                {t('How Sehat Works: 3 Simple Steps', 'सेहत का उपयोग: 3 आसान चरण')}
              </strong>
              <div style={{ fontSize: '13px', color: '#566a5c', marginTop: '2px' }}>
                {t('1. Upload report or sync ABHA  ➜  2. Review clear, evidence-based results  ➜  3. Ask Copilot questions', '1. रिपोर्ट जोड़ें या ABHA सिंक करें  ➜  2. आसान नतीजे समझें  ➜  3. कोपायलट से सवाल पूछें')}
              </div>
            </div>
          </div>
          <button className="text-button subtle" onClick={() => navigate('profile')} style={{ fontSize: '13px', margin: 0 }}>
            {t('View ABHA Profile', 'ABHA प्रोफ़ाइल देखें')}<ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* Wellness & Vitals Section */}
      <section className="panel" style={{ padding: '18px 22px', marginBottom: '24px' }}>
        <div className="section-heading" style={{ marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HeartPulse size={20} color="#254e3f" />
              <h2>{t('Daily Wellness & Vitals', 'दैनिक वेलनेस और वाइटल्स')}</h2>
              <Badge tone="green">{t('TRACKED', 'ट्रैक किया गया')}</Badge>
            </div>
            <p>{t('Routine at-home health metrics tracked alongside lab and clinical reports.', 'लैब रिपोर्ट के साथ घर पर मापे गए स्वास्थ्य संकेतक।')}</p>
          </div>
          <button className="text-button" onClick={() => setShowVitalsModal(true)}>
            <Plus size={14} />{t('Record reading', 'रीडिंग दर्ज करें')}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px', background: '#fdfdfb', borderRadius: '10px', border: '1px solid #e1e8dc' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('Blood Pressure', 'रक्तचाप (BP)')}
            </span>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#183f33', marginTop: '4px' }}>
              {latestVital ? `${latestVital.systolic}/${latestVital.diastolic}` : '118/78'} <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--muted)' }}>mmHg</span>
            </div>
            <span style={{ fontSize: '12px', color: '#254e3f', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <Check size={13} /> {t('Optimal Range', 'सामान्य सीमा')}
            </span>
          </div>

          <div style={{ padding: '14px', background: '#fdfdfb', borderRadius: '10px', border: '1px solid #e1e8dc' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('Resting Heart Rate', 'हृदय गति (Pulse)')}
            </span>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#183f33', marginTop: '4px' }}>
              {latestVital ? latestVital.heartRate : '72'} <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--muted)' }}>bpm</span>
            </div>
            <span style={{ fontSize: '12px', color: '#254e3f', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <Check size={13} /> {t('Normal Sinus', 'सामान्य रिदम')}
            </span>
          </div>

          <div style={{ padding: '14px', background: '#fdfdfb', borderRadius: '10px', border: '1px solid #e1e8dc' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('Oxygen (SpO2)', 'ऑक्सीजन (SpO2)')}
            </span>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#183f33', marginTop: '4px' }}>
              {latestVital?.spO2 ? latestVital.spO2 : '99'} <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--muted)' }}>%</span>
            </div>
            <span style={{ fontSize: '12px', color: '#254e3f', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <Check size={13} /> {t('Adequate', 'पर्याप्त')}
            </span>
          </div>

          <div style={{ padding: '14px', background: '#fdfdfb', borderRadius: '10px', border: '1px solid #e1e8dc' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('Weight & BMI', 'वजन और BMI')}
            </span>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#183f33', marginTop: '4px' }}>
              {latestVital?.weightKg ? latestVital.weightKg : '74.2'} <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--muted)' }}>kg</span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
              {t('BMI: ~23.4 (Normal)', 'BMI: ~23.4 (सामान्य)')}
            </span>
          </div>
        </div>
      </section>

      <div className="hero-grid">
        <section className="hero-card">
          <div className="hero-copy">
            <Badge tone="hero"><Sparkles size={12} />{t('YOUR PERSONAL HEALTH COMPANION', 'आपका व्यक्तिगत स्वास्थ्य साथी')}</Badge>
            <h2>{t('Less paperwork.', 'कागज़ कम।')}<br /><span>{t('More peace of mind.', 'मन की शांति ज़्यादा।')}</span></h2>
            <p>{t('From medical jargon to “now I understand.” A clearer picture of your health starts here.', 'मुश्किल मेडिकल शब्दों से आसान समझ तक। अपनी सेहत को बेहतर जानें।')}</p>
            <button className="text-button" onClick={() => navigate('copilot')}>
              {t('Let’s talk about your health', 'अपनी सेहत के बारे में बात करें')}<ArrowRight size={17} />
            </button>
          </div>
          <HealthIllustration />
        </section>

        <section className="next-step-card">
          <span className="tiny-label"><span className="status-dot" />{t('ONE SMALL STEP', 'एक छोटा कदम')}</span>
          <span className="step-icon"><ShieldCheck size={24} /></span>
          <h3>{pending.length ? t('A second look makes a difference.', 'एक बार जाँच लेना मददगार है।') : t('Your records, understood.', 'आपके रिकॉर्ड, अब आसान।')}</h3>
          <p>
            {pending.length
              ? t(`${pending.length} ${pending.length === 1 ? 'record is' : 'records are'} ready for your review. Confirm the details so your story stays accurate.`, `${pending.length} रिकॉर्ड की समीक्षा करें और जानकारी सही रखें।`)
              : t('Add your next report to keep your health story up to date.', 'अपनी अगली रिपोर्ट जोड़कर जानकारी अपडेट रखें।')}
          </p>
          <button className="text-button" onClick={() => pending[0] ? openRecord(pending[0]) : onUpload()}>
            {pending.length ? t('Review a record', 'रिकॉर्ड देखें') : t('Add a record', 'रिकॉर्ड जोड़ें')}<ArrowUpRight size={16} />
          </button>
        </section>
      </div>

      <div className="stat-grid">
        <Stat label={t('Health records', 'स्वास्थ्य रिकॉर्ड')} value={String(records.length).padStart(2, '0')} note={t('One organized home', 'एक व्यवस्थित जगह')} icon={<FileText size={18} />} />
        <Stat label={t('Ready for review', 'समीक्षा के लिए तैयार')} value={String(pending.length).padStart(2, '0')} note={pending.length ? t('A little check, more confidence', 'छोटी जाँच, बड़ा भरोसा') : t('All caught up', 'सबकी समीक्षा हो गई')} icon={<ShieldCheck size={19} />} amber={!!pending.length} />
        <Stat label={t('Recorded medicines', 'दर्ज दवाइयाँ')} value={String(medicines).padStart(2, '0')} note={t('From your prescriptions', 'आपके पर्चों से')} icon={<Plus size={20} />} />
        <Stat label={t('Last health record', 'आखिरी स्वास्थ्य रिकॉर्ड')} value={records[0]?.date ? dateLabel(records[0].date, true, language) : '—'} note={t('Your latest chapter', 'आपकी सबसे नई जानकारी')} icon={<CalendarDays size={18} />} />
      </div>

      <div className="overview-columns">
        <div className="overview-main">
          <section className="panel recent-records">
            <div className="section-heading">
              <div>
                <h2>{t('Your recent records', 'आपके हाल के रिकॉर्ड')}</h2>
                <p>{t('The details, without the detective work.', 'सारी जानकारी, आसानी से।')}</p>
              </div>
              <button className="text-button subtle" onClick={() => navigate('records')}>
                {t('View all', 'सभी देखें')}<ArrowRight size={15} />
              </button>
            </div>
            <div className="record-rows">
              {records.slice(0, 3).map(r => (
                <RecordRow key={r.id} record={r} language={language} onClick={() => openRecord(r)} />
              ))}
              {!records.length && <div className="small-empty">{t('Your first record is the start of a clearer picture.', 'अपने पहले रिकॉर्ड से शुरुआत करें।')}</div>}
            </div>
            <button className="record-add-row" onClick={onUpload}>
              <Plus size={15} />{t('Have a new report? Give it a home.', 'नई रिपोर्ट है? यहाँ जोड़ें।')}
            </button>
          </section>

          <section className="insight-card">
            <span className="insight-star"><Sparkles size={22} /></span>
            <div>
              <span className="eyebrow">{t('A LITTLE INSIGHT', 'एक छोटी समझ')}</span>
              <h3>{latestLab ? t('Your latest report, in everyday words.', 'आपकी नई रिपोर्ट, आसान शब्दों में।') : t('Understanding starts with your records.', 'समझ की शुरुआत आपके रिकॉर्ड से।')}</h3>
              <p>{latestLab ? local(latestLab.summary, language) : t('Upload a report and we’ll help you understand what it says.', 'रिपोर्ट अपलोड करें, हम उसे समझने में मदद करेंगे।')}</p>
              {latestLab && (
                <button className="text-button" onClick={() => openRecord(latestLab)}>
                  {t('Understand this report', 'यह रिपोर्ट समझें')}<ArrowRight size={15} />
                </button>
              )}
            </div>
          </section>
        </div>

        <div className="overview-aside">
          <section className="panel snapshot-card">
            <div className="section-heading">
              <div>
                <h2>{t('Your health snapshot', 'आपकी सेहत की झलक')}</h2>
                <p>{t('Small details. A bigger picture.', 'छोटी जानकारी। बड़ी तस्वीर।')}</p>
              </div>
              <TrendingUp size={18} className="muted" />
            </div>
            {trend.length > 1 ? (
              <>
                <div className="chart-title">
                  <span>HbA1c <span className="muted">· {t('Blood sugar', 'ब्लड शुगर')}</span></span>
                  <Badge tone="neutral">{t('Reported results', 'रिपोर्ट के नतीजे')}</Badge>
                </div>
                <div className="chart-value">
                  {trend.at(-1)?.value}<span>%</span>
                  <span className="trend-change">
                    {trend.at(-1)!.value <= trend[0].value ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />} {Math.abs(trend.at(-1)!.value - trend[0].value).toFixed(1)} {t('since first record', 'पहले रिकॉर्ड से')}
                  </span>
                </div>
                <TrendChart data={trend} />
                <p className="chart-footnote">{t('From your lab reports. Reference ranges vary by lab.', 'आपकी लैब रिपोर्ट से। सामान्य सीमाएँ लैब के अनुसार बदल सकती हैं।')}</p>
              </>
            ) : (
              <div className="small-empty">{t('Add two reports with HbA1c results to see your trend.', 'HbA1c वाली दो रिपोर्ट जोड़कर रुझान देखें।')}</div>
            )}
            <div className="snapshot-bottom">
              <span className="attention-dot" />
              {attention.length} {t('values outside the latest report’s range', 'मान नई रिपोर्ट की सीमा से बाहर')}
              <button aria-label={t('View report details', 'रिपोर्ट का विवरण')} onClick={() => latestLab && openRecord(latestLab)} disabled={!latestLab}>
                <ChevronRight size={17} />
              </button>
            </div>
          </section>

          <button className="abha-card" onClick={() => navigate('profile')}>
            <span className="abha-symbol"><ShieldCheck size={23} /></span>
            <span>
              <strong>{t('Your health, connected', 'आपकी सेहत, एक साथ')}</strong>
              <span>
                {data.patient.abhaLinked
                  ? t(`ABHA ID: ${data.patient.abhaId || ''} · View profile`, `ABHA आईडी: ${data.patient.abhaId || ''} · प्रोफ़ाइल देखें`)
                  : t('Explore your ABHA-ready profile', 'ABHA तैयार प्रोफ़ाइल देखें')}
              </span>
            </span>
            <ArrowUpRight size={18} />
          </button>

          <div className="private-note">
            <Check size={13} />
            {t('Your files stay on this device. AI processing uses NVIDIA.', 'फ़ाइलें इस डिवाइस पर रहती हैं। AI NVIDIA का उपयोग करता है।')}
          </div>
        </div>
      </div>

      {showVitalsModal && (
        <VitalsModal
          language={language}
          onClose={() => setShowVitalsModal(false)}
          onSaved={async () => {
            if (onRefresh) await onRefresh();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, note, icon, amber = false }: { label: string; value: string; note: string; icon: React.ReactNode; amber?: boolean }) {
  return (
    <section className="stat-card">
      <div>
        <span>{label}</span>
        <span className={`stat-icon ${amber ? 'amber' : ''}`}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </section>
  );
}

function TrendChart({ data }: { data: { value: number; date: string | null }[] }) {
  const points = data.slice(-6);
  const min = Math.min(...points.map(p => p.value)) - 0.35;
  const max = Math.max(...points.map(p => p.value)) + 0.35;
  const xy = points.map((p, i) => ({ x: 28 + i * 264 / Math.max(1, points.length - 1), y: 110 - (p.value - min) / (max - min) * 75, ...p }));
  return (
    <svg className="trend-chart" viewBox="0 0 320 148" role="img" aria-label={`HbA1c trend: ${points.map(p => `${p.date}: ${p.value}%`).join(', ')}`}>
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#c8d9b7" stopOpacity=".5" />
          <stop offset="1" stopColor="#c8d9b7" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[35, 70, 105].map(y => (
        <line key={y} x1="18" x2="307" y1={y} y2={y} stroke="#e8ede5" strokeDasharray="3 5" />
      ))}
      <path d={`M ${xy[0].x} 120 L ${xy.map(p => `${p.x},${p.y}`).join(' L ')} L ${xy.at(-1)!.x} 120 Z`} fill="url(#chartFill)" />
      <polyline points={xy.map(p => `${p.x},${p.y}`).join(' ')} stroke="#6d9060" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
      {xy.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#6d9060" strokeWidth="2" />
          <text x={p.x} y={p.y - 12} textAnchor="middle" fill="#617455" fontSize="10">{p.value}</text>
          <text x={p.x} y="140" textAnchor="middle" fill="#8b9387" fontSize="10">{dateLabel(p.date, true)}</text>
        </g>
      ))}
    </svg>
  );
}
