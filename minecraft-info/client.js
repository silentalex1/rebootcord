const body = document.getElementById('mcClientBody');

const installSection = document.createElement('div');
installSection.className = 'mc-install-section';

const installTitle = document.createElement('h2');
installTitle.className = 'mc-install-title';
installTitle.textContent = 'Install the Client';
installSection.appendChild(installTitle);

const installDesc = document.createElement('p');
installDesc.className = 'mc-install-desc';
installDesc.textContent = 'Run this command in your terminal to install the Reboot Cord Client app:';
installSection.appendChild(installDesc);

const codeWrap = document.createElement('div');
codeWrap.className = 'mc-install-code-wrap';

const codeBox = document.createElement('code');
codeBox.className = 'mc-install-code';
const installCmd = 'curl -fsSL https://rebootcord.world/install.sh | bash';
codeBox.textContent = installCmd;

const copyBtn = document.createElement('button');
copyBtn.className = 'mc-install-copy';
copyBtn.textContent = 'Copy';
copyBtn.onclick = () => {
  navigator.clipboard.writeText(installCmd).then(() => {
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
  });
};

codeWrap.appendChild(codeBox);
codeWrap.appendChild(copyBtn);
installSection.appendChild(codeWrap);

body.appendChild(installSection);

const comingSoon = document.createElement('div');
comingSoon.className = 'mc-coming-soon';
comingSoon.textContent = 'coming soon';
body.appendChild(comingSoon);

const featuresSection = document.createElement('div');
featuresSection.className = 'mc-features-section';

const featuresTitle = document.createElement('h2');
featuresTitle.className = 'mc-features-title';
featuresTitle.textContent = "The Reboot Cord Client app let's you:";
featuresSection.appendChild(featuresTitle);

const featuresList = document.createElement('ul');
featuresList.className = 'mc-features-list';
const features = [
  'add mods, plugins, to your minecraft server world (without restarting the server)',
  'lets you host the world',
  'trusted, 24/7, minecraft hosting service.'
];
features.forEach((f) => {
  const li = document.createElement('li');
  li.className = 'mc-features-item';
  li.textContent = f;
  featuresList.appendChild(li);
});
featuresSection.appendChild(featuresList);

const featuresTagline = document.createElement('div');
featuresTagline.className = 'mc-features-tagline';
featuresTagline.textContent = 'fast. Easy. Reliable. Setup.';
featuresSection.appendChild(featuresTagline);

body.appendChild(featuresSection);
