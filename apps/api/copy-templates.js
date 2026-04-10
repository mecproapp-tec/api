const fs = require('fs');
const path = require('path');

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(source)) return;

  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);

  for (const file of files) {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);

    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
      console.log(`📄 Copiado: ${curSource} -> ${curTarget}`);
    }
  }
}

// 🔥 caminhos
const paths = [
  {
    src: path.join(__dirname, 'src/modules/invoices/templates'),
    dest: path.join(__dirname, 'dist/modules/invoices/templates'),
  },
  {
    src: path.join(__dirname, 'src/modules/estimates/templates'),
    dest: path.join(__dirname, 'dist/modules/estimates/templates'),
  },
];

// 🔁 copiar tudo
paths.forEach(({ src, dest }) => {
  copyFolderRecursiveSync(src, dest);
});

console.log('✅ Templates copiados com sucesso!');