const fs = require('fs');
const files = ['src/app/index.tsx', 'src/app/post.tsx', 'src/app/wallet.tsx', 'src/app/profile.tsx', 'src/app/chaos.tsx', 'src/app/_layout.tsx'];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/#E5E5EA/g, '#1A1A1A'); // Replace dark gray text with black
  fs.writeFileSync(f, content);
});

files.forEach(f => {
  let lines = fs.readFileSync(f, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("color: '#FFFFFF'")) {
      let block = lines.slice(Math.max(0, i-4), i+1).join('\n');
      
      const blackStyles = ['anonName', 'anonNameInput', 'gridValue', 'timeLabel', 'timeBtnText', 'lockTitle', 'authInput', 'idAlias', 'logVal', 'pageTitle', 'authorName', 'editInput', 'roomName', 'bubbleText', 'statsValue', 'historyAmount', 'badgeText', 'inputLabel', 'charCount', 'postInput', 'disclaimerText', 'senderName', 'textActive', 'subtext'];
      
      if (blackStyles.some(s => block.includes(s + ':'))) {
        lines[i] = lines[i].replace("'#FFFFFF'", "'#1A1A1A'");
      }
    }
  }
  fs.writeFileSync(f, lines.join('\n'));
});
console.log('Fixed text colors');
