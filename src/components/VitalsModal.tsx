import { useState } from 'react';
import { LoaderCircle, Save } from 'lucide-react';
import type { Language } from '../../shared/types';
import { api } from '../api';
import { Modal } from './ui';

export default function VitalsModal({
  language,
  onClose,
  onSaved,
}: {
  language: Language;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [systolic, setSystolic] = useState('120');
  const [diastolic, setDiastolic] = useState('80');
  const [heartRate, setHeartRate] = useState('72');
  const [bloodGlucose, setBloodGlucose] = useState('');
  const [spO2, setSpO2] = useState('98');
  const [weightKg, setWeightKg] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const t = (en: string, hi: string) => (language === 'hi' ? hi : en);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.addVital({
        systolic: Number(systolic),
        diastolic: Number(diastolic),
        heartRate: Number(heartRate),
        bloodGlucose: bloodGlucose ? Number(bloodGlucose) : null,
        spO2: spO2 ? Number(spO2) : null,
        weightKg: weightKg ? Number(weightKg) : null,
        notes: notes.trim(),
        recordedAt: new Date().toISOString(),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t('Log Wellness & Vitals', 'वाइटल्स और स्वास्थ्य दर्ज करें')} onClose={onClose}>
      <form onSubmit={submit} className="upload-body">
        <p className="modal-intro">
          {t(
            'Keep your daily wellness markers updated alongside medical records.',
            'मेडिकल रिकॉर्ड के साथ अपने दैनिक स्वास्थ्य संकेतकों को अपडेट रखें।'
          )}
        </p>

        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <label>
            {t('Systolic BP (mmHg)', 'सिस्टोलिक बीपी (ऊपरी)')}
            <input
              type="number"
              required
              min="60"
              max="250"
              value={systolic}
              onChange={(e) => setSystolic(e.target.value)}
            />
          </label>
          <label>
            {t('Diastolic BP (mmHg)', 'डायस्टोलिक बीपी (निचला)')}
            <input
              type="number"
              required
              min="40"
              max="160"
              value={diastolic}
              onChange={(e) => setDiastolic(e.target.value)}
            />
          </label>
          <label>
            {t('Pulse / Heart Rate (bpm)', 'हृदय गति (bpm)')}
            <input
              type="number"
              required
              min="40"
              max="220"
              value={heartRate}
              onChange={(e) => setHeartRate(e.target.value)}
            />
          </label>
          <label>
            {t('Blood Oxygen SpO2 (%)', 'ऑक्सीजन SpO2 (%)')}
            <input
              type="number"
              min="70"
              max="100"
              value={spO2}
              onChange={(e) => setSpO2(e.target.value)}
            />
          </label>
          <label>
            {t('Fasting Glucose (mg/dL)', 'ब्लड शुगर (mg/dL)')}
            <input
              type="number"
              min="40"
              max="400"
              placeholder="Optional"
              value={bloodGlucose}
              onChange={(e) => setBloodGlucose(e.target.value)}
            />
          </label>
          <label>
            {t('Body Weight (kg)', 'शरीर का वजन (kg)')}
            <input
              type="number"
              step="0.1"
              min="20"
              max="300"
              placeholder="Optional"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </label>
          <label style={{ gridColumn: 'span 2' }}>
            {t('Notes / Activity context', 'टिप्पणी / संदर्भ')}
            <input
              type="text"
              placeholder={t('e.g., Morning resting reading after 5 min rest', 'जैसे: सुबह आराम के बाद ली गई रीडिंग')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}

        <footer className="modal-footer" style={{ marginTop: '20px', padding: 0, border: 'none' }}>
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            {t('Cancel', 'रद्द करें')}
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? <LoaderCircle size={16} className="spinner" /> : <Save size={16} />}
            {t('Save Vitals', 'वाइटल्स सहेजें')}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
