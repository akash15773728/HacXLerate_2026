import { createNimClient } from './nim.mjs';
import { createGeminiClient } from './gemini.mjs';

/**
 * Unified AI router supporting both Google Gemini Flash (Free Tier) and NVIDIA NIM.
 * Gemini Flash excels at deciphering messy, cursive doctor handwriting & multilingual prescriptions.
 */
export function createAiClient({
  gemini = createGeminiClient(),
  nim = createNimClient(),
  preferredProvider = process.env.OCR_PROVIDER || '',
} = {}) {
  // If Gemini is configured, it is preferred for handwritten prescription vision OCR
  const useGeminiVision = (preferredProvider === 'gemini' && gemini.configured) || (gemini.configured && preferredProvider !== 'nvidia');
  const useGeminiExtraction = (preferredProvider === 'gemini' && gemini.configured) || (!nim.configured && gemini.configured);
  const useGeminiChat = (preferredProvider === 'gemini' && gemini.configured) || (!nim.configured && gemini.configured);

  const configured = gemini.configured || nim.configured;

  return {
    configured,
    activeProvider: useGeminiVision ? 'gemini' : (nim.configured ? 'nvidia' : 'local'),
    geminiConfigured: gemini.configured,
    nvidiaConfigured: nim.configured,
    models: {
      vision: useGeminiVision ? gemini.models.vision : nim.models.vision,
      extraction: useGeminiExtraction ? gemini.models.extraction : nim.models.extraction,
      chat: useGeminiChat ? gemini.models.chat : nim.models.chat,
    },
    async vision(dataUrl) {
      if (useGeminiVision) {
        try {
          return await gemini.vision(dataUrl);
        } catch (err) {
          if (nim.configured) {
            console.warn('Gemini vision failed, falling back to NVIDIA NIM vision:', err?.message || err);
            return await nim.vision(dataUrl);
          }
          throw err;
        }
      }
      if (nim.configured) {
        try {
          return await nim.vision(dataUrl);
        } catch (err) {
          if (gemini.configured) {
            console.warn('NVIDIA NIM vision failed, falling back to Gemini vision:', err?.message || err);
            return await gemini.vision(dataUrl);
          }
          throw err;
        }
      }
      throw new Error('No vision OCR provider is configured.');
    },
    async extract(sourceText) {
      if (useGeminiExtraction) {
        try {
          return await gemini.extract(sourceText);
        } catch (err) {
          if (nim.configured) return await nim.extract(sourceText);
          throw err;
        }
      }
      if (nim.configured) {
        try {
          return await nim.extract(sourceText);
        } catch (err) {
          if (gemini.configured) return await gemini.extract(sourceText);
          throw err;
        }
      }
      throw new Error('No extraction provider is configured.');
    },
    async chat(message, language, facts) {
      if (useGeminiChat) {
        try {
          return await gemini.chat(message, language, facts);
        } catch (err) {
          if (nim.configured) return await nim.chat(message, language, facts);
          throw err;
        }
      }
      return await nim.chat(message, language, facts);
    },
  };
}
