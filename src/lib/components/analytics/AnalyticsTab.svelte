<script lang="ts">
  import { galleryCards } from './galleryData';
  import { themeStore } from '$lib/stores/theme.svelte';
  import DateRangePicker from './DateRangePicker.svelte';

  const dark = $derived(themeStore.theme === 'dark');
  let lightboxCard = $state<typeof galleryCards[0] | null>(null);
  let showEmailDialog = $state(false);
  let emailTo = $state('');
  let emailSending = $state(false);
  let emailResult = $state<{ ok: boolean; error?: string } | null>(null);

  // ── Date range filter ─────────────────────────────────────────────────────
  let startDate = $state('2025-11-11');
  let endDate   = $state('2026-03-03');

  // ── Exact data from AVK-Plast report ─────────────────────────────────────
  const DATES   = ["2025-11-11","2025-11-12","2025-11-13","2025-11-14","2025-11-17","2025-11-18","2025-11-19","2025-12-01","2025-12-02","2026-01-14","2026-01-15","2026-01-16","2026-01-19","2026-01-20","2026-01-21","2026-01-22","2026-01-23","2026-01-26","2026-01-27","2026-01-28","2026-01-29","2026-01-30","2026-02-02","2026-02-25","2026-02-26","2026-02-27","2026-03-02","2026-03-03"];
  const D_A     = [267,289,275,266,222,594,329,251,163,344,245,40,87,116,163,155,132,126,201,716,395,220,117,20,48,35,16,6];
  const D_B     = [151,165,89,54,76,65,9,13,27,35,58,36,53,37,54,0,0,0,0,0,0,0,0,0,0,0,0,0];
  const D_G     = [17332,16483,17887,6189,11425,11341,7884,4156,6913,9036,18081,9733,11446,16822,19411,0,9352,9459,15870,16444,14146,7566,2725,402,1140,834,354,117];
  const ROLLING = [1.51,1.61,1.58,1.85,1.86,2.31,2.46,2.86,3.08,3.66,3.02,2.84,2.12,1.6,1.25,1.09,0.88,0.84,0.94,1.46,1.74,2.01,2.39,4.6,4.1,4.03,4.05,4.08];
  const H_ANOM  = [203,200,239,281,288,204,292,263,328,309,274,281,187,245,117,198,312,336,298,296,221,168,163,135];
  const H_MEAS  = [44,43,23,45,40,38,72,74,60,47,47,45,40,39,37,25,36,34,36,29,31,32,28,17];
  const BIN_LABELS = ["0–9","10–19","20–29","30–39","40–49","50–59","60–69","70–79","80–89","90–99","100–109","110–119","120–129","130–139","140–149","150–159","160–169","170–179","180–189","190–199","200–209","210–219","220–229","230–239","240–249","250–259"];
  const BIN_GOOD   = [186618,18974,16734,13941,11350,8872,6845,5483,4183,3351,2454,1883,1450,1096,808,572,425,335,0,0,0,0,0,0,0,0];
  const BIN_DEFECT = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,30,323,245,236,200,169,152,153,4330];

  // ── Filtered data (reactive on date range) ────────────────────────────────
  const filteredIdx = $derived(
    DATES.reduce((acc, d, i) => {
      if ((!startDate || d >= startDate) && (!endDate || d <= endDate)) acc.push(i);
      return acc;
    }, [] as number[])
  );
  const fDATES   = $derived(filteredIdx.map(i => DATES[i]));
  const fD_A     = $derived(filteredIdx.map(i => D_A[i]));
  const fD_B     = $derived(filteredIdx.map(i => D_B[i]));
  const fD_G     = $derived(filteredIdx.map(i => D_G[i]));
  const fROLLING = $derived(filteredIdx.map(i => ROLLING[i]));

  // ── KPI totals ────────────────────────────────────────────────────────────
  const totalAnomaly     = $derived(fD_A.reduce((a, b) => a + b, 0));
  const totalMeasurement = $derived(fD_B.reduce((a, b) => a + b, 0));
  const totalGood        = $derived(fD_G.reduce((a, b) => a + b, 0));
  const totalInspections = $derived(totalAnomaly + totalMeasurement + totalGood);
  const anomalyPct       = $derived(totalInspections > 0 ? (totalAnomaly / totalInspections * 100).toFixed(2) : '0.00');
  const measurementPct   = $derived(totalInspections > 0 ? (totalMeasurement / totalInspections * 100).toFixed(2) : '0.00');
  const goodPct          = $derived(totalInspections > 0 ? (totalGood / totalInspections * 100).toFixed(2) : '0.00');

  // ── SVG: Daily stacked bar + rolling line ─────────────────────────────────
  const DW = 1400; const DH = 230; const DPX = 50; const DPY = 16; const DPB = 55;
  const chartN      = $derived(Math.max(fDATES.length, 1));
  const chartTotals = $derived(fDATES.map((_, i) => fD_A[i] + fD_B[i] + fD_G[i]));
  const chartMax    = $derived(chartTotals.length ? Math.max(...chartTotals) : 1);
  const chartMaxR   = $derived(fROLLING.length ? Math.max(...fROLLING) : 1);
  const barW        = $derived(Math.max(6, (DW - DPX - 10) / chartN - 8));

  function cdx(i: number, n: number) { return DPX + i * ((DW - DPX - 10) / n) + 1; }
  function cdy(v: number, max: number) { return DPY + (1 - v / max) * (DH - DPY - DPB); }
  function cbarH(v: number, max: number) { return (v / max) * (DH - DPY - DPB); }

  const rollingLine = $derived(
    fDATES.length > 1
      ? fDATES.map((_, i) => `${cdx(i, fDATES.length) + barW / 2},${cdy(fROLLING[i], chartMaxR * 1.15)}`).join(' ')
      : ''
  );

  // ── SVG: Hourly bars ──────────────────────────────────────────────────────
  const HW = 700; const HH = 180; const HPX = 10; const HPB = 24;
  const hourlyMax = Math.max(...H_ANOM.map((a, i) => a + H_MEAS[i]));
  function hx(i: number) { return HPX + i * ((HW - HPX * 2) / 24); }
  const hbw = (HW - HPX * 2) / 24 - 2;
  function hdy(v: number) { return (v / hourlyMax) * (HH - HPB); }

  // ── SVG: Score histogram (log scale) ─────────────────────────────────────
  const SW = 700; const SH = 180; const SPX = 10; const SPB = 24;
  const sbw = (SW - SPX * 2) / BIN_LABELS.length - 1;
  function sx(i: number) { return SPX + i * ((SW - SPX * 2) / BIN_LABELS.length); }
  function logH(n: number, maxH: number) {
    if (n <= 0) return 0;
    return (Math.log10(n) / Math.log10(maxH)) * (SH - SPB - 10);
  }
  const allBins = BIN_GOOD.map((g, i) => g + BIN_DEFECT[i]);
  const maxBin = Math.max(...allBins);
  const threshX = SPX + 17.5 * ((SW - SPX * 2) / BIN_LABELS.length);
  const borderX1 = SPX + 16 * ((SW - SPX * 2) / BIN_LABELS.length);
  const borderX2 = SPX + 20 * ((SW - SPX * 2) / BIN_LABELS.length);

  function fmt(n: number | string) {
    return Number(n).toLocaleString();
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function exportCSV() {
    const rows = [
      ['Date', 'Anomaly Defects', 'Measurement Defects', 'Good Parts', 'Total', 'Anomaly Rate %'],
      ...fDATES.map((d, i) => {
        const total = fD_A[i] + fD_B[i] + fD_G[i];
        return [d, fD_A[i], fD_B[i], fD_G[i], total, (fD_A[i] / total * 100).toFixed(2)];
      })
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avk-plast-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    window.print();
  }

  async function sendEmail() {
    if (!emailTo || emailSending) return;
    emailSending = true;
    emailResult = null;
    const subject = `AVK-Plast Inspection Report ${startDate} – ${endDate}`;
    const body =
      `AVK-Plast — Visual Inspection Report\n` +
      `${'─'.repeat(42)}\n` +
      `Period:                ${startDate} – ${endDate}\n` +
      `Production days:       ${fDATES.length}\n` +
      `\n` +
      `Total Inspections:     ${fmt(totalInspections)}\n` +
      `Anomaly Defects:       ${fmt(totalAnomaly)} (${anomalyPct}%)\n` +
      `Measurement Defects:   ${fmt(totalMeasurement)} (${measurementPct}%)\n` +
      `Good Parts:            ${fmt(totalGood)} (${goodPct}%)\n` +
      `\n` +
      `Configuration:\n` +
      `  BRIGHTNESS_THRESHOLD = 178.5\n` +
      `  SIMILARITY_THRESHOLD = 90%\n` +
      `\n` +
      `Generated by Deepvis · ${new Date().toLocaleString()}`;
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailTo, subject, body }),
      });
      emailResult = await res.json();
    } catch {
      emailResult = { ok: false, error: 'Network error' };
    }
    emailSending = false;
    if (emailResult?.ok) {
      setTimeout(() => { showEmailDialog = false; emailTo = ''; emailResult = null; }, 1500);
    }
  }
</script>

<!-- Lightbox -->
{#if lightboxCard}
  <div class="lb" onclick={() => (lightboxCard = null)}>
    <div class="lb-card" onclick={(e) => e.stopPropagation()}>
      <img src={lightboxCard.orig} alt="Original" />
      <img src={lightboxCard.heat} alt="Heatmap" />
      <div class="lb-overlay-wrap">
        <img src={lightboxCard.heat} alt="Overlay" />
        <div class="red-overlay"></div>
      </div>
      <div class="lb-meta">
        {lightboxCard.ts} · Score: {lightboxCard.score} · Click outside to close
      </div>
    </div>
  </div>
{/if}

<div class="wrap" class:dark>
<div class="container">

  <!-- Email dialog -->
  {#if showEmailDialog}
    <div class="email-backdrop" onclick={() => showEmailDialog = false}>
      <div class="email-dialog" onclick={(e) => e.stopPropagation()}>
        <div class="email-title">Send Report by Email</div>
        <div class="email-body">
          <label class="email-label">Recipient email</label>
          <input
            class="email-input"
            type="email"
            placeholder="name@company.com"
            bind:value={emailTo}
            onkeydown={(e) => e.key === 'Enter' && sendEmail()}
            disabled={emailSending}
          />
          {#if emailResult}
            <div class="email-result" class:email-ok={emailResult.ok} class:email-err={!emailResult.ok}>
              {emailResult.ok ? '✓ Email sent successfully' : `✗ ${emailResult.error}`}
            </div>
          {:else}
            <div class="email-note">Sends a report summary directly — no email client needed.</div>
          {/if}
        </div>
        <div class="email-actions">
          <button class="email-cancel" onclick={() => { showEmailDialog = false; emailResult = null; emailTo = ''; }} disabled={emailSending}>Cancel</button>
          <button class="email-send" onclick={sendEmail} disabled={!emailTo || emailSending}>
            {emailSending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Header -->
  <header>
    <div>
      <h1>AVK-Plast — Visual Inspection Report</h1>
      <div class="sub">Automated anomaly detection &nbsp;·&nbsp; {startDate} – {endDate} &nbsp;·&nbsp; {fDATES.length} production day{fDATES.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="header-btns">
      <div class="drp-wrap">
        <DateRangePicker bind:startDate bind:endDate />
      </div>
      <button class="export-btn" onclick={exportCSV} title="Download CSV">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        CSV
      </button>
      <button class="export-btn" onclick={exportPDF} title="Export PDF">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        PDF
      </button>
      <button class="export-btn" onclick={() => showEmailDialog = true} title="Send by email">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Email
      </button>
    </div>
  </header>

  <!-- Config note -->
  <div class="note">
    <strong>Configuration:</strong>
    <span class="var-pill">BRIGHTNESS_THRESHOLD = 178.5</span> (= 0.7 × 255, integer cutoff ≥ 179)
    &nbsp;·&nbsp; <span class="var-pill">SIMILARITY_THRESHOLD = 90%</span> (measurement defect if percent_similarity &lt; 90%)
    &nbsp;·&nbsp; Measurement defects = ellipse out-of-spec (semi_major/minor, deviation, roundness). Source: measurements_checked.csv.
    &nbsp;·&nbsp; Data from 2025-11-11 onwards only.
  </div>

  <!-- KPI Cards -->
  <div class="cards">
    <div class="card">
      <div class="label">Total Inspections</div>
      <div class="value accent">{fmt(totalInspections)}</div>
      <div class="sub">{fDATES.length} production day{fDATES.length !== 1 ? 's' : ''} · = total heatmaps</div>
    </div>
    <div class="card">
      <div class="label">Anomaly Defects</div>
      <div class="value red">{fmt(totalAnomaly)}</div>
      <div class="sub">{anomalyPct}% · brightness ≥ 179</div>
    </div>
    <div class="card">
      <div class="label">Measurement Defects</div>
      <div class="value yellow">{fmt(totalMeasurement)}</div>
      <div class="sub">{measurementPct}% · ellipse out-of-spec</div>
    </div>
    <div class="card">
      <div class="label">Good Parts</div>
      <div class="value green">{fmt(totalGood)}</div>
      <div class="sub">{goodPct}% · brightness &lt; 179 &amp; in-spec</div>
    </div>
  </div>

  <!-- Daily chart -->
  <div class="section">
    <h2>Daily Inspection Results &amp; Anomaly Rate Trend</h2>
    <div class="chart-scroll">
      <svg viewBox="0 0 {DW} {DH}" width="{DW}" style="min-width:{DW}px;height:auto;display:block">
        <!-- Y-axis gridlines (left: inspections) -->
        {#each [0, 5000, 10000, 15000, 20000] as v}
          {@const y = cdy(v, chartMax)}
          <line x1={DPX} y1={y} x2={DW - 10} y2={y} stroke="var(--border)" stroke-width="1"/>
          <text x={DPX - 4} y={y + 4} text-anchor="end" font-size="9" fill="var(--text2)" font-family="system-ui">{v === 0 ? '0' : (v/1000)+'k'}</text>
        {/each}

        <!-- Stacked bars -->
        {#each fDATES as _, i}
          {@const x = cdx(i, fDATES.length)}
          {@const gH = cbarH(fD_G[i], chartMax)}
          {@const aH = cbarH(fD_A[i], chartMax)}
          {@const bH = cbarH(fD_B[i], chartMax)}
          {@const baseY = DH - DPB}
          <!-- Good (bottom) -->
          <rect x={x} y={baseY - gH} width={barW} height={gH} fill="rgba(112,193,163,0.45)"/>
          <!-- Measurement (middle) -->
          <rect x={x} y={baseY - gH - bH} width={barW} height={bH} fill="rgba(251,191,36,0.55)"/>
          <!-- Anomaly (top) -->
          <rect x={x} y={baseY - gH - bH - aH} width={barW} height={aH} fill="rgba(229,115,115,0.85)"/>
          <text x={x + barW/2} y={DH - 38} text-anchor="end" font-size="8" fill="var(--text2)" font-family="system-ui"
            transform="rotate(-55,{x + barW/2},{DH - 38})">{fDATES[i].slice(5)}</text>
        {/each}

        <!-- Rolling anomaly rate line (right axis) -->
        {#if rollingLine}
          <polyline points={rollingLine} fill="none" stroke="#70c1a3" stroke-width="2.5" stroke-linejoin="round"/>
        {/if}
        {#each fDATES as _, i}
          <circle cx={cdx(i, fDATES.length) + barW/2} cy={cdy(fROLLING[i], chartMaxR * 1.15)} r="3" fill="#70c1a3"/>
        {/each}

        <!-- Right Y axis label -->
        <text x={DW - 4} y={DPY + 10} text-anchor="end" font-size="9" fill="#70c1a3" font-family="system-ui">Rate %</text>
        {#each [1, 2, 3, 4] as v}
          {@const y = cdy(v, chartMaxR * 1.15)}
          <text x={DW - 4} y={y + 4} text-anchor="end" font-size="9" fill="#70c1a3" font-family="system-ui">{v}%</text>
        {/each}
      </svg>
    </div>
    <!-- Legend -->
    <div class="legend">
      <span><span class="leg-box" style="background:rgba(112,193,163,0.45)"></span>Good Parts</span>
      <span><span class="leg-box" style="background:rgba(251,191,36,0.55)"></span>Measurement Defects</span>
      <span><span class="leg-box" style="background:rgba(229,115,115,0.85)"></span>Anomaly Defects</span>
      <span><span class="leg-line" style="background:#70c1a3"></span>7-Day Rolling Anomaly Rate</span>
    </div>
  </div>

  <!-- Hourly + Score Distribution -->
  <div class="two-col">

    <!-- Hourly -->
    <div class="section">
      <h2>Hourly Distribution</h2>
      <p class="chart-sub">Aggregated across all included days.</p>
      <svg viewBox="0 0 {HW} {HH}" width="100%">
        {#each [0, 200, 400, 600, 800] as v}
          {@const y = HH - HPB - hdy(v)}
          <line x1={HPX} y1={y} x2={HW - HPX} y2={y} stroke="var(--border)" stroke-width="1"/>
          <text x={HPX - 2} y={y + 4} text-anchor="end" font-size="8" fill="var(--text2)" font-family="system-ui">{v}</text>
        {/each}
        {#each Array.from({length: 24}, (_, i) => i) as i}
          {@const x = hx(i)}
          {@const mH = hdy(H_MEAS[i])}
          {@const aH = hdy(H_ANOM[i])}
          {@const base = HH - HPB}
          <rect x={x} y={base - mH} width={hbw} height={mH} fill="rgba(251,191,36,0.55)"/>
          <rect x={x} y={base - mH - aH} width={hbw} height={aH} fill="rgba(229,115,115,0.75)"/>
          {#if i % 3 === 0}
            <text x={x + hbw/2} y={HH - 6} text-anchor="middle" font-size="8" fill="var(--text2)" font-family="system-ui">{String(i).padStart(2,'0')}:00</text>
          {/if}
        {/each}
      </svg>
      <div class="legend">
        <span><span class="leg-box" style="background:rgba(251,191,36,0.55)"></span>Measurement</span>
        <span><span class="leg-box" style="background:rgba(229,115,115,0.75)"></span>Anomaly</span>
      </div>
    </div>

    <!-- Score Distribution -->
    <div class="section">
      <h2>Brightness Score Distribution</h2>
      <p class="chart-sub">Log scale. Threshold = 178.5 (≥179). Yellow band = borderline zone 160–199.</p>
      <svg viewBox="0 0 {SW} {SH}" width="100%">
        <!-- Borderline zone -->
        <rect x={borderX1} y="0" width={borderX2 - borderX1} height={SH - SPB} fill="rgba(251,191,36,0.08)"/>
        <rect x={borderX1} y="0" width="1" height={SH - SPB} fill="rgba(251,191,36,0.35)"/>
        <rect x={borderX2} y="0" width="1" height={SH - SPB} fill="rgba(251,191,36,0.35)"/>
        <text x={(borderX1+borderX2)/2} y="12" text-anchor="middle" font-size="8" fill="rgba(251,191,36,0.7)" font-family="system-ui">Borderline</text>

        <!-- Log gridlines -->
        {#each [1, 10, 100, 1000, 10000, 100000] as v}
          {@const y = SH - SPB - logH(v, maxBin)}
          {#if y > 0 && y < SH - SPB}
            <line x1={SPX} y1={y} x2={SW - SPX} y2={y} stroke="var(--border)" stroke-width="1"/>
            <text x={SPX - 2} y={y + 4} text-anchor="end" font-size="7" fill="var(--text2)" font-family="system-ui">{v >= 1000 ? (v/1000)+'k' : v}</text>
          {/if}
        {/each}

        <!-- Bars -->
        {#each BIN_LABELS as _, i}
          {@const x = sx(i)}
          {@const gH = logH(BIN_GOOD[i], maxBin)}
          {@const dH = logH(BIN_DEFECT[i], maxBin)}
          {@const base = SH - SPB}
          {#if BIN_GOOD[i] > 0}
            <rect x={x} y={base - gH} width={sbw} height={gH} fill="rgba(112,193,163,0.65)" rx="1"/>
          {/if}
          {#if BIN_DEFECT[i] > 0}
            <rect x={x} y={base - dH} width={sbw} height={dH} fill="rgba(229,115,115,0.75)" rx="1"/>
          {/if}
          {#if i % 2 === 0}
            <text x={x + sbw/2} y={SH - 6} text-anchor="middle" font-size="7"
              fill="var(--text2)" font-family="system-ui"
              transform="rotate(-60,{x + sbw/2},{SH - 6})">{BIN_LABELS[i]}</text>
          {/if}
        {/each}

        <!-- Threshold line -->
        <line x1={threshX} y1="0" x2={threshX} y2={SH - SPB} stroke="#e57373" stroke-width="2" stroke-dasharray="5,4"/>
        <text x={threshX + 3} y="20" font-size="8" fill="#e57373" font-family="system-ui" font-weight="600">Threshold 178.5</text>
      </svg>
      <div class="legend">
        <span><span class="leg-box" style="background:rgba(112,193,163,0.65)"></span>Good (&lt; 179)</span>
        <span><span class="leg-box" style="background:rgba(229,115,115,0.75)"></span>Defect (≥ 179)</span>
      </div>
    </div>

  </div>

  <!-- Period summary table -->
  <div class="section">
    <h2>Period Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Period</th><th>Days</th><th>Total</th>
          <th>Anomaly Defects</th><th>Anomaly Rate</th>
          <th>Meas. Defects</th><th>Meas. Rate</th>
          <th>Good Parts</th><th>Note</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Nov 11–19, 2025</strong></td><td>7</td><td>91,392</td>
          <td class="red">2,242</td><td class="red">2.45%</td>
          <td class="yellow">609</td><td class="yellow">0.67%</td>
          <td class="green">88,541</td>
          <td><span class="badge med">Early production</span></td>
        </tr>
        <tr>
          <td><strong>Dec 1–2, 2025</strong></td><td>2</td><td>11,523</td>
          <td class="red">414</td><td class="red">3.59%</td>
          <td class="yellow">40</td><td class="yellow">0.35%</td>
          <td class="green">11,069</td>
          <td><span class="badge med">Short window</span></td>
        </tr>
        <tr>
          <td><strong>Jan 14–21, 2026</strong></td><td>6</td><td>85,797</td>
          <td class="red">995</td><td class="green">1.16%</td>
          <td class="yellow">273</td><td class="yellow">0.32%</td>
          <td class="green">84,529</td>
          <td><span class="badge low">Stable</span></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Anomaly Defect Gallery -->
  <div class="section">
    <h2>Anomaly Defect Gallery — 50 Samples</h2>
    <p class="chart-sub" style="margin-bottom:16px">
      Each card: original (left) · heatmap (centre) · heatmap overlay at 60% red opacity (right).
      Click a card to enlarge. Sampled across all 23 production days, Nov 2025 – Feb 2026.
    </p>
    <div class="gallery-grid">
      {#each galleryCards as card}
        <div class="gallery-card" onclick={() => (lightboxCard = card)}>
          <div class="gallery-imgs">
            <img src={card.orig} alt="Original" loading="lazy" />
            <img src={card.heat} alt="Heatmap"  loading="lazy" />
            <div class="overlay-wrap">
              <img src={card.heat} alt="Overlay" loading="lazy" />
              <div class="red-tint"></div>
            </div>
          </div>
          <div class="gallery-meta">
            <span class="gallery-ts">{card.ts}</span>
            <span class="gallery-score">Score: {card.score}</span>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <footer>
    <strong>Classification:</strong> Anomaly = heatmap brightness ≥ 179 (0.7 × 255) · Measurement defect = ellipse out-of-spec (roundness, deviation, semi-axes) · Good = brightness &lt; 179 &amp; in-spec ·
    Total inspections = total heatmaps · Data from 2025-11-11 onwards · Source: dataset.csv + measurements_checked.csv
  </footer>

</div>
</div>

<style>
  /* ── Theme ─────────────────────────────────────────────────────────────── */
  /* light mode (default) */
  .wrap {
    --bg:      var(--bg-canvas); --surface: var(--surface-1); --surface2: var(--surface-2); --border: var(--surface-border);
    --text:    var(--text-1); --text2: var(--text-2); --accent: #3aad86;
    --red:     #c62828; --green:   #2e7d32; --yellow:   #b45309;
  }
  /* dark mode */
  .wrap.dark {
    --bg:      var(--bg-canvas); --surface: var(--surface-1); --surface2: var(--surface-2); --border: var(--surface-border);
    --text:    var(--text-1); --text2: var(--text-2); --accent: #70c1a3;
    --red:     #ff4d6a; --green:   #34d399; --yellow:   #fbbf24;
  }

  /* ── Base ──────────────────────────────────────────────────────────────── */
  .wrap {
    height: 100%; overflow-y: auto;
    background-color: var(--bg);
    background-image: radial-gradient(circle, var(--dot-color) 0.5px, transparent 0.5px);
    background-size: 20px 20px;
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 14px; line-height: 1.6;
  }
  .container { max-width: 1400px; margin: 0 auto; padding: 24px; }

  /* ── Header ────────────────────────────────────────────────────────────── */
  header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
    padding: 36px 0 28px; border-bottom: 1px solid var(--border); margin-bottom: 32px;
  }
  header h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.3px; }
  .sub { color: var(--text2); margin-top: 6px; font-size: 14px; }
  .header-btns { display: flex; gap: 8px; flex-shrink: 0; }
  .drp-wrap { position: relative; }

  .export-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 0 12px; height: 32px; border-radius: 8px;
    font-size: 12px; font-weight: 500;
    background: var(--surface); border: 1px solid var(--border);
    color: var(--text2); cursor: pointer;
    transition: border-color .15s, color .15s;
    white-space: nowrap;
  }
  .export-btn:hover { border-color: var(--accent); color: var(--text); }

  /* Email dialog */
  .email-backdrop {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
  }
  .email-dialog {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 24px; width: 360px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
  }
  .email-title { font-size: 15px; font-weight: 600; margin-bottom: 16px; color: var(--text); }
  .email-body { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
  .email-label { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: var(--text2); }
  .email-input {
    padding: 8px 12px; border-radius: 8px; font-size: 13px;
    background: var(--surface2); border: 1px solid var(--border);
    color: var(--text); outline: none;
  }
  .email-input:focus { border-color: #70c1a3; }
  .email-note { font-size: 11px; color: var(--text2); line-height: 1.5; }
  .email-result { font-size: 12px; font-weight: 500; padding: 6px 10px; border-radius: 6px; }
  .email-ok  { background: rgba(112,193,163,0.15); color: #70c1a3; }
  .email-err { background: rgba(229,115,115,0.15); color: #e57373; }
  .email-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .email-cancel {
    padding: 0 14px; height: 32px; border-radius: 8px;
    font-size: 13px; font-weight: 500;
    background: var(--surface2); border: 1px solid var(--border);
    color: var(--text2); cursor: pointer;
  }
  .email-cancel:hover { color: var(--text); }
  .email-send {
    padding: 0 14px; height: 32px; border-radius: 8px;
    font-size: 13px; font-weight: 600;
    background: #70c1a3; border: none; color: #0f1f18; cursor: pointer;
  }
  .email-send:hover { background: #8dd0b5; }
  .email-send:disabled { opacity: .4; cursor: not-allowed; }

  /* ── Note ──────────────────────────────────────────────────────────────── */
  .note {
    background: var(--surface2); border: 1px solid var(--border);
    border-left: 3px solid var(--yellow); border-radius: 8px;
    padding: 12px 16px; margin-bottom: 24px; font-size: 13px;
    color: var(--text2); line-height: 1.7;
  }
  .note strong { color: var(--yellow); }
  .var-pill {
    display: inline-block; background: var(--surface); border: 1px solid var(--border);
    border-radius: 6px; padding: 3px 10px; font-family: monospace; font-size: 12px;
    color: var(--accent); margin: 0 2px;
  }

  /* ── Cards ─────────────────────────────────────────────────────────────── */
  .cards {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 16px; margin-bottom: 32px;
  }
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 20px;
  }
  .label { color: var(--text2); font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; }
  .value { font-size: 28px; font-weight: 700; margin-top: 6px; }
  .card .sub { color: var(--text2); font-size: 12px; margin-top: 4px; }
  .accent { color: var(--accent); } .red { color: var(--red); }
  .green  { color: var(--green); } .yellow { color: var(--yellow); }

  /* ── Sections ──────────────────────────────────────────────────────────── */
  .section {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 24px; margin-bottom: 24px;
  }
  .section h2 { font-size: 15px; font-weight: 600; margin-bottom: 20px; }
  .chart-sub { font-size: 12px; color: var(--text2); margin-bottom: 16px; margin-top: -12px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  @media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }

  /* ── Chart helpers ─────────────────────────────────────────────────────── */
  .chart-scroll { overflow-x: auto; scrollbar-width: none; }
  .chart-scroll::-webkit-scrollbar { display: none; }
  .legend { display: flex; gap: 16px; margin-top: 12px; flex-wrap: wrap; font-size: 12px; color: var(--text2); }
  .legend span { display: flex; align-items: center; gap: 6px; }
  .leg-box { width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0; }
  .leg-line { width: 20px; height: 2.5px; border-radius: 2px; flex-shrink: 0; }

  /* ── Table ─────────────────────────────────────────────────────────────── */
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th {
    text-align: left; padding: 10px 14px; color: var(--text2);
    font-weight: 500; font-size: 12px; text-transform: uppercase;
    letter-spacing: 0.5px; border-bottom: 1px solid var(--border);
  }
  td { padding: 10px 14px; border-bottom: 1px solid var(--border); }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--surface2); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge.high { background: rgba(255,77,106,0.15); color: var(--red); }
  .badge.med  { background: rgba(251,191,36,0.15);  color: var(--yellow); }
  .badge.low  { background: rgba(52,211,153,0.15);  color: var(--green); }

  /* ── Gallery ───────────────────────────────────────────────────────────── */
  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
  }
  .gallery-card {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 10px; overflow: hidden; cursor: zoom-in;
    transition: border-color .15s, transform .1s;
  }
  .gallery-card:hover { border-color: var(--accent); transform: translateY(-1px); }
  .gallery-imgs {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
  }
  .gallery-imgs img {
    width: 100%; aspect-ratio: 1; object-fit: cover; display: block;
  }
  .overlay-wrap { position: relative; }
  .overlay-wrap img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
  .red-tint {
    position: absolute; inset: 0;
    background: rgba(255, 77, 106, 0.6);
    mix-blend-mode: multiply;
    pointer-events: none;
  }
  .gallery-meta {
    padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;
  }
  .gallery-ts   { font-size: 11px; color: var(--text2); }
  .gallery-score { font-size: 11px; font-weight: 600; color: var(--red); }

  /* ── Lightbox ──────────────────────────────────────────────────────────── */
  .lb {
    display: flex; position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.88); align-items: center; justify-content: center;
    cursor: zoom-out; padding: 24px;
  }
  .lb-card {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;
    max-width: 90vw; cursor: default;
    background: var(--surface); border-radius: 12px;
    padding: 12px; box-shadow: 0 8px 48px rgba(0,0,0,0.7);
  }
  .lb-card img { width: 100%; aspect-ratio: 1; object-fit: contain; border-radius: 6px; display: block; }
  .lb-overlay-wrap { position: relative; }
  .lb-overlay-wrap img { width: 100%; aspect-ratio: 1; object-fit: contain; border-radius: 6px; display: block; }
  .red-overlay {
    position: absolute; inset: 0; border-radius: 6px;
    background: rgba(255, 77, 106, 0.6); mix-blend-mode: multiply; pointer-events: none;
  }
  .lb-meta {
    grid-column: 1 / -1; text-align: center;
    color: #8b8fa3; font-size: 12px; padding-top: 4px;
  }

  /* ── Footer ────────────────────────────────────────────────────────────── */
  footer {
    color: var(--text2); font-size: 12px; padding: 24px 0;
    border-top: 1px solid var(--border); margin-top: 8px; line-height: 1.8;
  }

  /* ── Print / PDF ────────────────────────────────────────────────────────── */
  @media print {
    .wrap {
      height: auto !important; overflow: visible !important;
      background: white !important; background-image: none !important;
      color: #111 !important;
      --bg: white; --surface: #fff; --surface2: #f5f5f5;
      --border: #ddd; --text: #111; --text2: #555;
      --accent: #3aad86; --red: #c62828; --green: #2e7d32; --yellow: #b45309;
    }
    .container { padding: 16px !important; }

    /* Hide interactive controls */
    .header-btns, .email-backdrop { display: none !important; }

    /* Header */
    header { padding: 16px 0 12px !important; margin-bottom: 16px !important; }

    /* Cards: 4 across */
    .cards { grid-template-columns: repeat(4, 1fr) !important; gap: 10px !important; margin-bottom: 16px !important; }
    .card { padding: 12px !important; break-inside: avoid; }
    .value { font-size: 20px !important; }

    /* Sections */
    .section { padding: 14px !important; margin-bottom: 12px !important; break-inside: avoid; }

    /* Charts: scale to page width */
    .chart-scroll { overflow: visible !important; }
    .chart-scroll svg { width: 100% !important; min-width: unset !important; height: auto !important; }

    /* Two-col stays two-col */
    .two-col { gap: 12px !important; }

    /* Page breaks */
    .section:nth-of-type(4) { break-before: page; }

    /* Gallery */
    .gallery-grid { grid-template-columns: repeat(4, 1fr) !important; gap: 8px !important; break-before: page; }
    .gallery-card { break-inside: avoid; }
    .gallery-meta { padding: 4px 8px !important; }

    /* Table */
    table { font-size: 11px !important; }
    th, td { padding: 6px 8px !important; }
    tr { break-inside: avoid; }
  }
</style>
