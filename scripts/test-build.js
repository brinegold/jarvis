#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Testing optimized build...\n');

try {
  // Clean previous build
  console.log('🧹 Cleaning previous build...');
  if (fs.existsSync('.next')) {
    fs.rmSync('.next', { recursive: true, force: true });
  }

  // Run build
  console.log('🔨 Building application...');
  execSync('npm run build', { stdio: 'inherit' });

  // Check build output
  const buildDir = path.join(process.cwd(), '.next');
  if (fs.existsSync(buildDir)) {
    console.log('✅ Build completed successfully!');
    
    // Get build stats
    const statsPath = path.join(buildDir, 'build-manifest.json');
    if (fs.existsSync(statsPath)) {
      const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      console.log('\n📊 Build Statistics:');
      console.log(`- Pages: ${Object.keys(stats.pages || {}).length}`);
      console.log(`- Static files: ${Object.keys(stats.sortedPages || []).length}`);
    }

    // Check for critical files
    const criticalFiles = [
      'static/chunks/pages/_app.js',
      'static/chunks/pages/index.js',
      'static/chunks/pages/dashboard.js'
    ];

    console.log('\n🔍 Checking critical files:');
    criticalFiles.forEach(file => {
      const filePath = path.join(buildDir, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`✅ ${file} (${sizeKB} KB)`);
      } else {
        console.log(`❌ ${file} - Not found`);
      }
    });

  } else {
    console.log('❌ Build directory not found!');
    process.exit(1);
  }

  console.log('\n🎉 Build test completed successfully!');
  console.log('\n💡 Next steps:');
  console.log('   - Run "npm start" to test production build');
  console.log('   - Run "npm run lighthouse" to test performance');
  console.log('   - Run "npm run analyze" to analyze bundle size');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
