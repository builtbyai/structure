/**
 * Configuration Loader Tests
 */

import { loadConfig } from '../../src/config/loader';

describe('Config Loader', () => {
  describe('loadConfig', () => {
    it('should return default config when no files exist', async () => {
      const config = await loadConfig();

      expect(config).toBeDefined();
      expect(config.debug).toBe(false);
      expect(config.model).toBe('standard');
    });
  });

  describe('deepMerge behavior', () => {
    it('should merge CLI options over defaults', async () => {
      const config = await loadConfig({ debug: true });

      expect(config.debug).toBe(true);
    });
  });
});
