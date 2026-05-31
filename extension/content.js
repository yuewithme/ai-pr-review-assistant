const match = location.href.match(
  /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/,
);

if (match) {
  document.documentElement.dataset.aiPrReviewCurrentPrUrl =
    `https://github.com/${match[1]}/${match[2]}/pull/${match[3]}`;
}

