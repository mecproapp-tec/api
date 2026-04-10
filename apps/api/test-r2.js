const { StorageService } = require('./dist/modules/storage/storage.service');
const service = new StorageService();

(async () => {
  const buffer = Buffer.from('teste pdf content', 'utf-8');
  try {
    const url = await service.uploadPdf(buffer, 'teste/manual.pdf');
    console.log('✅ Upload OK:', url);
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
})();