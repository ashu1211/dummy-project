// Global App State
const state = {
    activeTab: 'dashboard-page',
    cameraStream: null,
    scanInterval: null,
    isScanning: false,
    lastScanTime: 0,
    scanDelayMs: 1500, // interval between auto-scans
    trafficChart: null,
    visitors: [],
    logs: [],
    currentFrameB64: null,
    // UI rendering state to avoid refreshing/flickering
    currentStatus: 'none', // 'none', 'recognized', 'unrecognized'
    currentVisitorId: null
};

// DOM Elements
const elements = {
    navItems: document.querySelectorAll('.nav-item'),
    pageViews: document.querySelectorAll('.page-view'),
    video: document.getElementById('webcam-video'),
    canvas: document.getElementById('overlay-canvas'),
    scannerOverlay: document.getElementById('scanner-overlay'),
    btnToggleCamera: document.getElementById('btn-toggle-camera'),
    btnManualScan: document.getElementById('btn-manual-scan'),
    
    // Result elements
    resultCard: document.getElementById('scan-result-card'),
    resultCrop: document.getElementById('result-crop'),
    resultName: document.getElementById('result-name'),
    resultBadge: document.getElementById('result-badge'),
    resultStats: document.getElementById('result-stats'),
    
    // Form elements
    checkinForm: document.getElementById('checkin-form'),
    formVisitorId: document.getElementById('form-visitor-id'),
    formSnapshotB64: document.getElementById('form-snapshot-b64'),
    formIsRegistered: document.getElementById('form-is-registered'),
    formName: document.getElementById('form-name'),
    formToMeet: document.getElementById('form-to-meet'),
    formFrom: document.getElementById('form-from'),
    formPurpose: document.getElementById('form-purpose'),
    btnSubmitCheckin: document.getElementById('btn-submit-checkin'),
    btnResetForm: document.getElementById('btn-reset-form'),
    
    // Stats Elements
    statRegistered: document.getElementById('stat-registered-count'),
    statVisits: document.getElementById('stat-visits-count'),
    dashboardTicker: document.getElementById('dashboard-ticker'),
    
    // Lists & Tables
    registryList: document.getElementById('registry-list'),
    registrySearch: document.getElementById('registry-search'),
    logsTableBody: document.getElementById('logs-table-body'),
    logSearchName: document.getElementById('log-search-name'),
    logSearchHost: document.getElementById('log-search-host'),
    toastCenter: document.getElementById('toast-center'),

    // Last Visits Panel (below camera)
    lastVisitsPanel: document.getElementById('last-visits-panel'),
    lastVisitsList: document.getElementById('last-visits-list'),

    // ID Accordion (check-in panel)
    idAccordion: document.getElementById('id-accordion'),
    idAccordionToggle: document.getElementById('id-accordion-toggle'),
    idAccordionBody: document.getElementById('id-accordion-body'),
    idChevron: document.getElementById('id-chevron'),
    btnSaveIdentity: document.getElementById('btn-save-identity'),
    btnRefreshCamera: document.getElementById('btn-refresh-camera'),

    // ID Modal (registry)
    idModal: document.getElementById('id-modal')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initCameraControls();
    initCheckInForm();
    initIdAccordion();
    initAnalytics();
    
    // Initial fetch of dashboard data
    fetchDashboardStats();
    fetchRegistry();
    fetchLogs();
});

// 1. Navigation Routing Routing
function initNavigation() {
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            switchTab(targetId);
        });
    });
}

function switchTab(targetId) {
    // Update active tab in navbar
    elements.navItems.forEach(item => {
        if (item.getAttribute('data-target') === targetId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Toggle pages
    elements.pageViews.forEach(page => {
        if (page.id === targetId) {
            page.classList.add('active');
        } else {
            page.classList.remove('active');
        }
    });

    state.activeTab = targetId;
    clearCanvas();

    // Trigger tab-specific events
    if (targetId === 'scanner-page') {
        startCamera();
    } else {
        stopCamera();
    }

    if (targetId === 'dashboard-page') {
        fetchDashboardStats();
    } else if (targetId === 'registry-page') {
        fetchRegistry();
    } else if (targetId === 'logs-page') {
        fetchLogs();
    }
}

// 2. Toast Notifications
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    
    const iconClass = type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check';
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    elements.toastCenter.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// 3. Camera Controller
async function startCamera() {
    if (state.cameraStream) return;
    
    try {
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        };
        
        state.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        elements.video.srcObject = state.cameraStream;
        
        elements.video.onloadedmetadata = () => {
            elements.video.play();
            resizeCanvas();
            startScannerLoop();
            elements.btnToggleCamera.innerHTML = '<i class="fa-solid fa-video-slash"></i> Stop Camera';
            showToast("Camera stream connected.", "success");
        };
    } catch (err) {
        console.error("Camera access failed: ", err);
        showToast("Unable to access camera. Check browser permissions.", "error");
    }
}

function stopCamera() {
    stopScannerLoop();
    if (state.cameraStream) {
        state.cameraStream.getTracks().forEach(track => track.stop());
        state.cameraStream = null;
    }
    elements.video.srcObject = null;
    elements.btnToggleCamera.innerHTML = '<i class="fa-solid fa-video"></i> Start Camera';
    clearCanvas();
}

function initCameraControls() {
    elements.btnToggleCamera.addEventListener('click', () => {
        if (state.cameraStream) {
            stopCamera();
        } else {
            startCamera();
        }
    });

    elements.btnManualScan.addEventListener('click', () => {
        if (!state.cameraStream) {
            showToast("Please activate camera first.", "error");
            return;
        }
        scanCurrentFrame();
    });

    elements.btnRefreshCamera.addEventListener('click', async () => {
        stopCamera();
        await new Promise(r => setTimeout(r, 600)); // brief pause before restart
        startCamera();
        showToast('Camera refreshed.', 'success');
    });

    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    if (elements.video.srcObject) {
        elements.canvas.width = elements.video.clientWidth;
        elements.canvas.height = elements.video.clientHeight;
    }
}

function clearCanvas() {
    const ctx = elements.canvas.getContext('2d');
    ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
}

// 4. Face Scanning Pipeline
function startScannerLoop() {
    state.isScanning = true;
    
    const loop = async () => {
        if (!state.isScanning) return;
        
        const now = Date.now();
        if (now - state.lastScanTime >= state.scanDelayMs) {
            await scanCurrentFrame();
            state.lastScanTime = now;
        }
        
        requestAnimationFrame(loop);
    };
    
    requestAnimationFrame(loop);
}

function stopScannerLoop() {
    state.isScanning = false;
}

async function scanCurrentFrame() {
    if (!state.cameraStream || elements.video.paused) return;

    // Create offscreen canvas to capture frame
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = elements.video.videoWidth;
    captureCanvas.height = elements.video.videoHeight;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(elements.video, 0, 0, captureCanvas.width, captureCanvas.height);
    
    const base64Img = captureCanvas.toDataURL('image/jpeg', 0.85);
    state.currentFrameB64 = base64Img;

    try {
        const response = await fetch('/api/detect-recognize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Img })
        });
        
        if (!response.ok) throw new Error("Backend response error");
        const data = await response.json();
        
        handleScanResponse(data, base64Img);
        
    } catch (err) {
        console.error("Scan API failed: ", err);
    }
}

function handleScanResponse(data, originalBase64) {
    const ctx = elements.canvas.getContext('2d');
    ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);

    if (!data.detected) {
        // No face detected — hide last visits panel and reset border
        elements.scannerOverlay.style.borderColor = 'transparent';
        elements.lastVisitsPanel.style.display = 'none';
        return;
    }

    // Scale face bounding box from original frame coordinates to video display coordinates
    const scaleX = elements.video.clientWidth / elements.video.videoWidth;
    const scaleY = elements.video.clientHeight / elements.video.videoHeight;
    
    const [x, y, w, h] = data.box;
    const scaledX = x * scaleX;
    const scaledY = y * scaleY;
    const scaledW = w * scaleX;
    const scaledH = h * scaleY;

    // Draw high-tech HUD box
    ctx.lineWidth = 2;
    ctx.strokeStyle = data.recognized ? '#10b981' : '#f59e0b'; // green for recognized, amber for new
    ctx.strokeRect(scaledX, scaledY, scaledW, scaledH);
    
    // Draw corners
    ctx.fillStyle = ctx.strokeStyle;
    const size = 10;
    ctx.fillRect(scaledX, scaledY, size, size); // top-left
    ctx.fillRect(scaledX + scaledW - size, scaledY, size, size); // top-right
    ctx.fillRect(scaledX, scaledY + scaledH - size, size, size); // bottom-left
    ctx.fillRect(scaledX + scaledW - size, scaledY + scaledH - size, size, size); // bottom-right
    
    // If the identification state hasn't changed, we exit early to prevent flickering and overwriting inputs
    if (data.recognized) {
        if (state.currentStatus === 'recognized' && state.currentVisitorId === data.visitor_id) {
            return; // Already showing this recognized visitor's details, do not refresh
        }
    } else {
        if (state.currentStatus === 'unrecognized') {
            return; // Already showing unregistered visitor form, do not refresh
        }
    }

    // Update state
    state.currentStatus = data.recognized ? 'recognized' : 'unrecognized';
    state.currentVisitorId = data.recognized ? data.visitor_id : null;

    // Set form capture image state
    elements.formSnapshotB64.value = originalBase64;
    
    // Display result preview
    elements.resultCard.style.display = 'block';
    elements.resultCrop.src = data.cropped_face;
    elements.btnSubmitCheckin.disabled = false;

    if (data.recognized) {
        // Known visitor
        elements.scannerOverlay.style.borderColor = '#10b981';
        elements.resultCrop.className = "crop-preview";
        elements.resultName.innerText = data.name;
        
        const confidence = Math.round(data.score * 100);
        elements.resultBadge.innerText = `Recognized (${confidence}% Match)`;
        elements.resultBadge.className = "match-badge success";
        
        // Show visit stats summary
        const stats = data.visit_stats;
        elements.resultStats.style.display = 'block';
        if (stats.last_visit_time) {
            elements.resultStats.innerHTML = `
                <p><i class="fa-solid fa-sync"></i> Frequency: Visited <span>${stats.total_visits} times</span></p>
                <p><i class="fa-solid fa-clock"></i> Last Check-in: <span>${stats.last_visit_time}</span></p>
                <p><i class="fa-solid fa-user"></i> Last Host: Met <span>${stats.last_meet}</span> (from <span>${stats.last_from}</span>)</p>
            `;
        } else {
            elements.resultStats.innerHTML = `
                <p><i class="fa-solid fa-sync"></i> Frequency: First check-in under profile (Total: <span>${stats.total_visits}</span>)</p>
            `;
        }

        // Fill form fields
        elements.formVisitorId.value = data.visitor_id;
        elements.formIsRegistered.value = 'true';
        elements.formName.value = data.name;
        elements.formName.readOnly = true;
        elements.formToMeet.focus();

        // Render last visits panel below camera
        renderLastVisits(data.recent_visits || []);

        // Show ID accordion and pre-fill if data exists
        elements.idAccordion.style.display = 'block';
        loadVisitorIdentity(data.visitor_id);
    } else {
        // New visitor — hide last visits panel and show amber state
        elements.scannerOverlay.style.borderColor = '#f59e0b';
        elements.resultCrop.className = 'crop-preview unknown';
        elements.resultName.innerText = 'New / Unrecognized Face';
        elements.resultBadge.innerText = 'Unregistered Visitor';
        elements.resultBadge.className = 'match-badge warning';
        elements.resultStats.style.display = 'none';

        elements.formVisitorId.value = '';
        elements.formIsRegistered.value = 'false';
        elements.formName.value = '';
        elements.formName.readOnly = false;
        elements.formName.focus();
        elements.lastVisitsPanel.style.display = 'none';
    }
}

function renderLastVisits(visits) {
    if (!visits || visits.length === 0) {
        elements.lastVisitsPanel.style.display = 'none';
        return;
    }

    elements.lastVisitsList.innerHTML = '';
    visits.forEach(v => {
        // Format date nicely: "29 Jun 2026, 14:48"
        const dt = new Date(v.visit_time.replace(' ', 'T'));
        const dateStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

        const row = document.createElement('div');
        row.className = 'last-visit-row';
        row.innerHTML = `
            <img src="${v.photo_path}" class="last-visit-snapshot" alt="snapshot"
                 onerror="this.style.display='none'">
            <div class="last-visit-details">
                <div class="lv-host"><i class="fa-solid fa-user-tie" style="font-size:10px; margin-right:4px; color:var(--color-primary);"></i>${v.to_meet}</div>
                <div class="lv-meta">${v.from_location} &nbsp;·&nbsp; ${v.purpose}</div>
            </div>
            <div class="last-visit-time">${dateStr}<br>${timeStr}</div>
        `;
        elements.lastVisitsList.appendChild(row);
    });

    elements.lastVisitsPanel.style.display = 'block';
}

// 5. Check-in Form Submission Submission
function initCheckInForm() {
    elements.checkinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            visitor_id: elements.formVisitorId.value ? parseInt(elements.formVisitorId.value) : null,
            name: elements.formName.value.trim(),
            to_meet: elements.formToMeet.value.trim(),
            from_location: elements.formFrom.value.trim(),
            purpose: elements.formPurpose.value.trim(),
            image: elements.formSnapshotB64.value,
            register_new: elements.formIsRegistered.value === 'false'
        };

        if (!payload.image) {
            showToast("No face snapshot captured. Scan face again.", "error");
            return;
        }

        try {
            elements.btnSubmitCheckin.disabled = true;
            elements.btnSubmitCheckin.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Checking in...';

            const response = await fetch('/api/checkin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Check-in request failed");
            const resData = await response.json();
            
            showToast(`Check-in complete! Welcome, ${resData.name}. (Visits: ${resData.visit_count})`, "success");
            resetCheckInForm();
            
        } catch (err) {
            console.error("Check-in error: ", err);
            showToast("Failed to complete check-in. Try again.", "error");
            elements.btnSubmitCheckin.disabled = false;
            elements.btnSubmitCheckin.innerHTML = '<i class="fa-solid fa-circle-check"></i> Complete Check-in';
        }
    });

    elements.btnResetForm.addEventListener('click', resetCheckInForm);
}

function resetCheckInForm() {
    elements.checkinForm.reset();
    elements.formVisitorId.value = '';
    elements.formSnapshotB64.value = '';
    elements.formIsRegistered.value = 'false';
    elements.formName.readOnly = false;
    elements.resultCard.style.display = 'none';
    elements.btnSubmitCheckin.disabled = true;
    elements.btnSubmitCheckin.innerHTML = '<i class="fa-solid fa-circle-check"></i> Complete Check-in';
    
    // Reset status to allow detecting again
    state.currentStatus = 'none';
    state.currentVisitorId = null;

    // Hide last visits panel and ID accordion
    elements.lastVisitsPanel.style.display = 'none';
    elements.lastVisitsList.innerHTML = '';
    elements.idAccordion.style.display = 'none';
    elements.idAccordionBody.classList.remove('open');
    elements.idChevron.style.transform = '';

    clearCanvas();
}

// 6. API Integrations
async function fetchDashboardStats() {
    try {
        const response = await fetch('/api/stats');
        if (!response.ok) throw new Error();
        const data = await response.json();

        // Update cards
        elements.statRegistered.innerText = data.total_registered;
        elements.statVisits.innerText = data.today_visits;

        // Render Graph
        updateTrafficChart(data.hourly_stats);
        
        // Load Ticker
        loadLiveTicker();
    } catch (err) {
        console.error("Stats fetch failed");
    }
}

async function loadLiveTicker() {
    try {
        const response = await fetch('/api/logs?limit=5');
        if (!response.ok) throw new Error();
        const logs = await response.json();
        
        elements.dashboardTicker.innerHTML = '';
        if (logs.length === 0) {
            elements.dashboardTicker.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding-top:40px;">No visits recorded today.</p>';
            return;
        }
        
        logs.forEach(log => {
            const item = document.createElement('div');
            item.className = 'ticker-item';
            
            // Format time
            const time = log.visit_time.split(' ')[1].substring(0, 5);
            
            item.innerHTML = `
                <div class="ticker-item-left">
                    <img src="${log.photo_path}" class="ticker-avatar" alt="Avatar">
                    <div class="ticker-info">
                        <h5>${log.name}</h5>
                        <p>To meet: ${log.to_meet} | From: ${log.from_location}</p>
                    </div>
                </div>
                <div class="ticker-time">${time}</div>
            `;
            elements.dashboardTicker.appendChild(item);
        });
    } catch (err) {
        console.error("Ticker fetch failed");
    }
}

async function fetchRegistry() {
    try {
        const response = await fetch('/api/visitors');
        if (!response.ok) throw new Error();
        state.visitors = await response.json();
        renderRegistry();
    } catch (err) {
        console.error("Registry fetch failed");
    }
}

function renderRegistry(filterText = '') {
    elements.registryList.innerHTML = '';
    
    const filtered = state.visitors.filter(visitor => 
        visitor.name.toLowerCase().includes(filterText.toLowerCase())
    );
    
    if (filtered.length === 0) {
        elements.registryList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">No matching registered profiles found.</p>';
        return;
    }
    
    filtered.forEach(visitor => {
        const card = document.createElement('div');
        card.className = 'card visitor-card';
        card.innerHTML = `
            <span class="badge">${visitor.visit_count} Visits</span>
            <img src="${visitor.photo_path}" class="avatar" alt="${visitor.name}">
            <h4>${visitor.name}</h4>
            <p>Registered: ${visitor.created_at.split(' ')[0]}</p>
        `;
        elements.registryList.appendChild(card);
    });
}

// Search filters
elements.registrySearch.addEventListener('input', (e) => {
    renderRegistry(e.target.value);
});

async function fetchLogs() {
    try {
        const response = await fetch('/api/logs');
        if (!response.ok) throw new Error();
        state.logs = await response.json();
        renderLogs();
    } catch (err) {
        console.error("Logs fetch failed");
    }
}

function renderLogs() {
    elements.logsTableBody.innerHTML = '';
    
    const filterName = elements.logSearchName.value.toLowerCase();
    const filterHost = elements.logSearchHost.value.toLowerCase();
    
    const filtered = state.logs.filter(log => 
        log.name.toLowerCase().includes(filterName) &&
        log.to_meet.toLowerCase().includes(filterHost)
    );
    
    if (filtered.length === 0) {
        elements.logsTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
                    No logs found matching filters.
                </td>
            </tr>
        `;
        return;
    }
    
    filtered.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><img src="${log.photo_path}" class="user-avatar" alt="face"></td>
            <td style="font-weight: 500;">${log.name}</td>
            <td>${log.to_meet}</td>
            <td>${log.from_location}</td>
            <td><span style="color: var(--text-muted);">${log.purpose || 'N/A'}</span></td>
            <td>${log.visit_time}</td>
            <td>
                <span class="match-badge ${log.visitor_id ? 'success' : 'warning'}" style="font-size:11px;">
                    ${log.visit_number} Visits
                </span>
            </td>
        `;
        elements.logsTableBody.appendChild(row);
    });
}

elements.logSearchName.addEventListener('input', renderLogs);
elements.logSearchHost.addEventListener('input', renderLogs);

// 7. ChartJS Setup Setup
function initAnalytics() {
    const ctx = document.getElementById('trafficChart').getContext('2d');
    
    // Initialize chart with empty/default layout
    state.trafficChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Visits',
                data: [],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#8b5cf6',
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', stepSize: 1 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

function updateTrafficChart(hourlyStats) {
    if (!state.trafficChart) return;
    
    const hours = Object.keys(hourlyStats);
    const counts = Object.values(hourlyStats);
    
    // Find hours with visits to filter out empty ends of the chart
    // But keep a reasonable range (e.g. 08:00 to 18:00)
    let startIndex = 8; // 08:00
    let endIndex = 18; // 18:00
    
    // Adjust range if visits are outside standard office hours
    for (let i = 0; i < counts.length; i++) {
        if (counts[i] > 0) {
            if (i < startIndex) startIndex = Math.max(0, i - 1);
            if (i > endIndex) endIndex = Math.min(23, i + 1);
        }
    }
    
    const filteredHours = hours.slice(startIndex, endIndex + 1);
    const filteredCounts = counts.slice(startIndex, endIndex + 1);
    
    state.trafficChart.data.labels = filteredHours;
    state.trafficChart.data.datasets[0].data = filteredCounts;
    state.trafficChart.update();
}

// ── 8. ID Accordion ────────────────────────────────────────────────────────
function initIdAccordion() {
    elements.idAccordionToggle.addEventListener('click', () => {
        const isOpen = elements.idAccordionBody.classList.toggle('open');
        elements.idChevron.style.transform = isOpen ? 'rotate(180deg)' : '';
    });

    elements.btnSaveIdentity.addEventListener('click', saveVisitorIdentity);
}

async function loadVisitorIdentity(visitorId) {
    try {
        const res = await fetch(`/api/visitor/${visitorId}/identity`);
        if (!res.ok) return;
        const d = await res.json();

        document.getElementById('id-aadhar').value    = d.aadhar_no        || '';
        document.getElementById('id-pan').value       = d.pan_no           || '';
        document.getElementById('id-voter').value     = d.voter_id         || '';
        document.getElementById('id-driving').value   = d.driving_license  || '';
        document.getElementById('id-passport').value  = d.passport_no      || '';
        document.getElementById('id-company').value   = d.company_name     || '';
        document.getElementById('id-company-id').value = d.company_id      || '';
        document.getElementById('id-school').value    = d.school_name      || '';
        document.getElementById('id-college').value   = d.college_name     || '';
        document.getElementById('id-address').value   = d.office_address   || '';
    } catch (e) {
        console.error('loadVisitorIdentity error', e);
    }
}

async function saveVisitorIdentity() {
    const visitorId = elements.formVisitorId.value;
    if (!visitorId) {
        showToast('Scan and identify visitor first.', 'error');
        return;
    }

    const payload = {
        aadhar_no:       document.getElementById('id-aadhar').value.trim(),
        pan_no:          document.getElementById('id-pan').value.trim().toUpperCase(),
        voter_id:        document.getElementById('id-voter').value.trim(),
        driving_license: document.getElementById('id-driving').value.trim(),
        passport_no:     document.getElementById('id-passport').value.trim(),
        company_name:    document.getElementById('id-company').value.trim(),
        company_id:      document.getElementById('id-company-id').value.trim(),
        school_name:     document.getElementById('id-school').value.trim(),
        college_name:    document.getElementById('id-college').value.trim(),
        office_address:  document.getElementById('id-address').value.trim()
    };

    try {
        elements.btnSaveIdentity.disabled = true;
        elements.btnSaveIdentity.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';

        const res = await fetch(`/api/visitor/${visitorId}/identity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error();
        showToast('ID details saved successfully!', 'success');
    } catch (e) {
        showToast('Failed to save ID details.', 'error');
    } finally {
        elements.btnSaveIdentity.disabled = false;
        elements.btnSaveIdentity.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save ID Details';
    }
}

// ── 9. Registry Visitor ID Modal ───────────────────────────────────────────
let _modalVisitorId = null;

function renderRegistry(filterText = '') {
    elements.registryList.innerHTML = '';
    
    const filtered = state.visitors.filter(visitor => 
        visitor.name.toLowerCase().includes(filterText.toLowerCase())
    );
    
    if (filtered.length === 0) {
        elements.registryList.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">No matching registered profiles found.</p>';
        return;
    }
    
    filtered.forEach(visitor => {
        const card = document.createElement('div');
        card.className = 'card visitor-card';
        card.title = 'Click to view / edit ID details';
        card.innerHTML = `
            <span class="badge">${visitor.visit_count} Visits</span>
            <img src="${visitor.photo_path}" class="avatar" alt="${visitor.name}">
            <h4>${visitor.name}</h4>
            <p>Registered: ${visitor.created_at.split(' ')[0]}</p>
            <p style="color:var(--color-primary); font-size:11px; margin-top:6px;"><i class="fa-solid fa-id-card"></i> View / Edit IDs</p>
        `;
        card.addEventListener('click', () => openIdModal(visitor));
        elements.registryList.appendChild(card);
    });
}

async function openIdModal(visitor) {
    _modalVisitorId = visitor.id;
    document.getElementById('modal-name').innerText = visitor.name;
    document.getElementById('modal-avatar').src = visitor.photo_path;

    // Load identity data
    try {
        const res = await fetch(`/api/visitor/${visitor.id}/identity`);
        const d = await res.json();
        document.getElementById('modal-aadhar').value      = d.aadhar_no       || '';
        document.getElementById('modal-pan').value         = d.pan_no          || '';
        document.getElementById('modal-voter').value       = d.voter_id        || '';
        document.getElementById('modal-driving').value     = d.driving_license || '';
        document.getElementById('modal-passport').value    = d.passport_no     || '';
        document.getElementById('modal-company').value     = d.company_name    || '';
        document.getElementById('modal-company-id').value  = d.company_id      || '';
        document.getElementById('modal-school').value      = d.school_name     || '';
        document.getElementById('modal-college').value     = d.college_name    || '';
        document.getElementById('modal-address').value     = d.office_address  || '';
    } catch(e) { console.error(e); }

    elements.idModal.style.display = 'flex';
    document.getElementById('btn-modal-save').onclick = saveModalIdentity;
}

function closeIdModal(e) {
    if (e && e.target !== elements.idModal) return;
    elements.idModal.style.display = 'none';
    _modalVisitorId = null;
}

async function saveModalIdentity() {
    if (!_modalVisitorId) return;

    const payload = {
        aadhar_no:       document.getElementById('modal-aadhar').value.trim(),
        pan_no:          document.getElementById('modal-pan').value.trim().toUpperCase(),
        voter_id:        document.getElementById('modal-voter').value.trim(),
        driving_license: document.getElementById('modal-driving').value.trim(),
        passport_no:     document.getElementById('modal-passport').value.trim(),
        company_name:    document.getElementById('modal-company').value.trim(),
        company_id:      document.getElementById('modal-company-id').value.trim(),
        school_name:     document.getElementById('modal-school').value.trim(),
        college_name:    document.getElementById('modal-college').value.trim(),
        office_address:  document.getElementById('modal-address').value.trim()
    };

    try {
        const res = await fetch(`/api/visitor/${_modalVisitorId}/identity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error();
        showToast('ID details saved!', 'success');
        elements.idModal.style.display = 'none';
    } catch(e) {
        showToast('Save failed. Try again.', 'error');
    }
}
