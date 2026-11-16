/*
   ===============================================================
   APP.JS = CONNECT THE BANK LOGIC TO THE HTML SCREEN
   ===============================================================
   1. HTML gives buttons, tables and page sections.
   2. CSS makes the dashboard beautiful.
   3. bank.js calculates REAL queue / stack operations.
   4. This file shows data and handles button clicks.

   BASIC JS used here: variables, if/else, for loops, functions,
   arrays, objects, innerHTML, getElementById, addEventListener.
*/

// ====================== 1. SMALL HELPERS ======================
function el(id) {
    return document.getElementById(id);
}

// Never directly insert a customer's typed name as HTML.
function safe(text) {
    return String(text).replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showTime(time) {
    if (!time) return '—';
    return new Date(time).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit'
    });
}

function timeAgo(time) {
    const minutes = Math.floor((Date.now() - time) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return minutes + ' min ago';
    return Math.floor(minutes / 60) + ' hr ago';
}

let messageTimer;
function toast(message) {
    el('toast').textContent = message;
    el('toast').classList.add('show');
    clearTimeout(messageTimer);
    messageTimer = setTimeout(function () {
        el('toast').classList.remove('show');
    }, 2800);
}

// One place to handle errors and update the interface.
function runAction(action, message) {
    try {
        action();        // Run a function from bank.js.
        bank.save();     // Remember results after browser refresh.
        render();        // Update all HTML tables and cards.
        toast(message);
    } catch (error) {
        toast('⚠ ' + error.message);
    }
}

let currentPage = 'overview';
let serviceFilter = 'all';

const PAGE_NAMES = {
    overview: ['Overview', 'Good day, Administrator ✳', "Here's what's happening across your branch today."],
    queue: ['Queue Management', 'Queue management', 'Track customers, priorities, and service demand in real time.'],
    counters: ['Service Counters', 'Service counters', 'Manage live customer calls and counter availability.'],
    structures: ['DS Visualizer', 'Data structures visualizer', 'See linked lists, queues and stacks working behind the scenes.'],
    history: ['Activity History', 'Activity & history', 'Review completed services and recent operations.']
};

// ====================== 2. SWITCH PAGE ======================
function goToPage(page) {
    if (!PAGE_NAMES[page]) return;
    currentPage = page;

    // Hide every page except the one selected in sidebar.
    const pageNames = ['overview', 'queue', 'counters', 'structures', 'history'];
    for (const name of pageNames) {
        el(name + 'Page').classList.toggle('hidden', name !== page);
    }

    // Statistics don't appear on Visualizer / History (same as old UI).
    el('statsCards').classList.toggle('hidden', page === 'structures' || page === 'history');

    // Change heading at the top.
    el('crumb').textContent = PAGE_NAMES[page][0];
    el('pageTitle').textContent = PAGE_NAMES[page][1];
    el('pageSub').textContent = PAGE_NAMES[page][2];

    // Highlight the selected sidebar navigation button.
    for (const button of document.querySelectorAll('.nav')) {
        button.classList.toggle('active', button.dataset.page === page);
    }
    window.scrollTo(0, 0);
}

// ====================== 3. DASHBOARD NUMBERS ======================
function renderStats() {
    const stats = bank.stats();
    el('statWaiting').textContent = stats.waiting;
    el('statServing').textContent = stats.serving;
    el('statCompleted').textContent = stats.completed;
    el('statWaitTime').textContent = stats.avgWait + 'm';
}

// ====================== 4. SERVICE QUEUE CARDS ======================
function renderServiceList() {
    let html = '';
    let maxWaiting = 1;

    for (const service of SERVICES) {
        if (bank.waitingCount(service.id) > maxWaiting) {
            maxWaiting = bank.waitingCount(service.id);
        }
    }

    for (const service of SERVICES) {
        const queues = bank.queues[service.id];
        const count = bank.waitingCount(service.id);
        const percent = (count / maxWaiting) * 100;
        const wait = count * service.minutes;

        html += `
            <div class="service-row">
                <div class="service-icon" style="background:${service.color}18;color:${service.color}">
                    ${service.icon}
                </div>
                <div class="service-info">
                    <strong>${safe(service.name)}</strong>
                    <small>${queues.priority.count} priority · ${queues.regular.count} regular · ~${wait} min total</small>
                    <div class="progress">
                        <div style="width:${percent}%;background:${service.color}"></div>
                    </div>
                </div>
                <div class="service-count">${count}<small>waiting</small></div>
            </div>
        `;
    }

    el('overviewServices').innerHTML = html;
    el('queueServices').innerHTML = html;
}

// ====================== 5. COUNTER STATUS ======================
function statusBadge(counter) {
    if (counter.paused) return '<span class="pill paused">Paused</span>';
    if (counter.current) return '<span class="pill busy">● Serving</span>';
    return '<span class="pill">● Available</span>';
}

function renderCounterStatus() {
    let html = '';
    for (const counter of bank.counters) {
        const service = bank.getService(counter.service);
        let tokenText = '';
        if (counter.current) tokenText = ' · ' + safe(counter.current.token);

        html += `
            <div class="counter-row">
                <div class="counter-num">0${counter.id}</div>
                <div class="counter-info">
                    <strong>${safe(counter.name)}</strong>
                    <small>${safe(service.name)}${tokenText}</small>
                </div>
                ${statusBadge(counter)}
            </div>
        `;
    }
    el('overviewCounters').innerHTML = html;
}

// ====================== 6. CUSTOMER TABLES ======================
function customerCategory(customer) {
    if (customer.priority === 'regular') return '<span class="pill regular">Regular</span>';
    if (customer.priority === 'senior') return '<span class="pill priority">Senior citizen</span>';
    return '<span class="pill priority">Accessibility</span>';
}

function customerAvatar(name) {
    const words = name.trim().split(' ');
    let initials = words[0][0];
    if (words.length > 1 && words[1]) initials += words[1][0];
    return safe(initials.toUpperCase());
}

// Generate HTML <tr> rows for either waiting or completed customers.
function tableRows(customers, completed) {
    if (customers.length === 0) {
        return '<tr><td colspan="6"><div class="empty"><strong>No customers to display</strong>Generate a token or load demo data.</div></td></tr>';
    }

    let html = '';
    for (const customer of customers) {
        const service = bank.getService(customer.service);
        let action = `<button class="btn small danger" data-action="remove" data-token="${safe(customer.token)}">Remove</button>`;
        let time = showTime(customer.createdAt);

        if (completed) {
            action = '0' + customer.counterId;
            time = showTime(customer.completedAt);
        }

        html += `
            <tr>
                <td><span class="token">${safe(customer.token)}</span></td>
                <td><div class="customer">
                    <div class="customer-avatar">${customerAvatar(customer.name)}</div>
                    <strong>${safe(customer.name)}</strong>
                </div></td>
                <td>${safe(service.name)}</td>
                <td>${customerCategory(customer)}</td>
                <td>${time}</td>
                <td>${action}</td>
            </tr>
        `;
    }
    return html;
}

function renderCustomerTables() {
    const all = bank.getWaiting();
    el('overviewWaiting').innerHTML = tableRows(all.slice(0, 5), false);

    const search = el('search').value.toLowerCase().trim();
    const filtered = [];
    for (const customer of all) {
        const correctService = serviceFilter === 'all' || customer.service === serviceFilter;
        const correctSearch = customer.name.toLowerCase().includes(search) ||
            customer.token.toLowerCase().includes(search);
        if (correctService && correctSearch) filtered.push(customer);
    }
    el('queueTable').innerHTML = tableRows(filtered, false);
    el('historyTable').innerHTML = tableRows(bank.history, true);
    el('completedNote').textContent = bank.completed + ' customers served this session';
}

// ====================== 7. RECENT ACTIVITY ======================
function renderActivity() {
    let html = '';
    const latest = bank.events.slice(0, 6);

    if (latest.length === 0) html = '<div class="empty">No recent activity</div>';

    for (const event of latest) {
        let icon = '+';
        if (event.type === 'call') icon = '↗';
        if (event.type === 'complete') icon = '✓';
        if (event.type === 'undo') icon = '↶';

        html += `
            <div class="activity-item">
                <div class="activity-dot">${icon}</div>
                <div><strong>${safe(event.message)}</strong><small>${timeAgo(event.time)}</small></div>
            </div>
        `;
    }
    el('overviewEvents').innerHTML = html;
    el('queueEvents').innerHTML = html;
    el('historyEvents').innerHTML = html;
}

// ====================== 8. LIVE COUNTER CARDS ======================
function renderCounterCards() {
    let html = '';

    for (const counter of bank.counters) {
        const service = bank.getService(counter.service);
        const waiting = bank.waitingCount(counter.service);
        let token = '— — —';
        let name = 'Ready for next customer';
        if (counter.current) {
            token = safe(counter.current.token);
            name = safe(counter.current.name);
        }

        // Disabled buttons prevent invalid operations.
        const cannotCall = counter.paused || counter.current || waiting === 0;
        const cannotComplete = counter.current === null;
        const cannotToggle = counter.current !== null;

        html += `
            <div class="panel counter-card">
                <div class="counter-card-top">
                    <div><h3>${safe(counter.name)}</h3>
                        <p>${safe(service.name)} · ${waiting} customers waiting</p></div>
                    ${statusBadge(counter)}
                </div>
                <div class="now-serving">
                    <small>NOW SERVING</small>
                    <div class="big-token">${token}</div>
                    <strong>${name}</strong>
                </div>
                <div class="actions">
                    <button class="btn primary" data-action="next" data-id="${counter.id}"
                        ${cannotCall ? 'disabled' : ''}>↗ Call next</button>
                    <button class="btn secondary" data-action="complete" data-id="${counter.id}"
                        ${cannotComplete ? 'disabled' : ''}>✓ Complete</button>
                    <button class="btn secondary" data-action="toggle" data-id="${counter.id}"
                        ${cannotToggle ? 'disabled' : ''}>${counter.paused ? '▶ Resume' : 'Ⅱ Pause'}</button>
                </div>
            </div>
        `;
    }
    el('counterCards').innerHTML = html;
    el('undoCount').textContent = bank.undoStack.count;
}

// ====================== 9. DS VISUALIZER ======================
function drawNodes(customers, priority) {
    let html = '<div class="nodes"><span class="null">HEAD →</span>';
    if (customers.length === 0) html += '<span class="null">EMPTY</span>';

    // Limit diagram to 8 nodes so the page stays readable.
    for (let i = 0; i < customers.length && i < 8; i++) {
        const color = priority ? 'priority-node' : '';
        html += `<div class="node ${color}">${safe(customers[i].token)}</div>`;
        html += '<span class="arrow">→</span>';
    }
    if (customers.length > 8) html += '<span class="null">... →</span>';
    return html + '<span class="null">NULL</span></div>';
}

function renderVisualizer() {
    let html = '';
    for (const service of SERVICES) {
        const group = bank.queues[service.id];
        html += `
            <div class="panel visual-panel">
                <h2 style="color:${service.color}">${service.icon} ${safe(service.name)}</h2>
                <p>Priority linked queue · ${group.priority.count} nodes</p>
                ${drawNodes(group.priority.toArray(), true)}
                <p>Regular linked queue · ${group.regular.count} nodes</p>
                ${drawNodes(group.regular.toArray(), false)}
                <div class="ds-code">enqueue() → O(1)   dequeue() → O(1)
findToken() → O(n)   removeToken() → O(n)
Nodes connected using next references</div>
            </div>
        `;
    }
    el('visualQueues').innerHTML = html;

    // Show real operations stored in the linked-list undo stack.
    const operations = bank.undoStack.toArray();
    let stackHtml = '<span class="null">TOP →</span>';
    if (operations.length === 0) stackHtml += '<span class="null">EMPTY</span>';
    for (let i = 0; i < operations.length && i < 5; i++) {
        stackHtml += `<span class="node">${safe(operations[i].action)}</span><span class="arrow">→</span>`;
    }
    if (operations.length > 5) stackHtml += '<span class="null">... →</span>';
    el('stackNodes').innerHTML = stackHtml + '<span class="null">NULL</span>';
    el('undoVisual').disabled = operations.length === 0;
    el('undoCounter').disabled = operations.length === 0;
    el('undoHistory').disabled = operations.length === 0;

    // Uses the actual insertion-sort method in bank.js.
    let sortedHtml = '';
    const ranked = bank.rankedServices();
    for (let i = 0; i < ranked.length; i++) {
        sortedHtml += `<div class="ranking-row"><strong>#${i + 1} ${safe(ranked[i].name)}</strong>
            <span>${bank.waitingCount(ranked[i].id)} waiting</span></div>`;
    }
    el('rankedServices').innerHTML = sortedHtml;
}

// ====================== 10. UPDATE EVERYTHING ======================
function render() {
    renderStats();
    renderServiceList();
    renderCounterStatus();
    renderCustomerTables();
    renderActivity();
    renderCounterCards();
    renderVisualizer();
}

// ====================== 11. BUTTON CLICK EVENTS ======================
// This ONE listener handles sidebar buttons and generated counter buttons.
document.addEventListener('click', function (event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;

    // Switch between pages.
    if (button.dataset.page) {
        goToPage(button.dataset.page);
        return;
    }

    // Filter list by banking service.
    if (button.dataset.filter) {
        serviceFilter = button.dataset.filter;
        for (const filterButton of document.querySelectorAll('.filter')) {
            filterButton.classList.toggle('active', filterButton.dataset.filter === serviceFilter);
        }
        renderCustomerTables();
        return;
    }

    const action = button.dataset.action;
    const id = Number(button.dataset.id);

    if (action === 'remove') {
        const token = button.dataset.token;
        if (confirm('Remove token ' + token + '?')) {
            runAction(function () { bank.removeCustomer(token); }, 'Token removed');
        }
    }
    if (action === 'next') {
        runAction(function () { bank.callNext(id); }, 'Next customer called');
    }
    if (action === 'complete') {
        runAction(function () { bank.complete(id); }, 'Customer service completed');
    }
    if (action === 'toggle') {
        runAction(function () { bank.toggleCounter(id); }, 'Counter status updated');
    }
});

// Search as you type (simple string matching for list display).
el('search').addEventListener('input', renderCustomerTables);

// The Find Token button calls the REAL LINKED-LIST SEARCH method.
el('findToken').addEventListener('click', function () {
    const token = el('search').value.trim().toUpperCase();
    if (!token) return toast('Type a token such as D-001');
    const customer = bank.findCustomer(token);
    if (customer) toast('✓ Found ' + customer.token + ': ' + customer.name);
    else toast('Token ' + token + ' not in any waiting linked queue');
});

// ====================== 12. NEW CUSTOMER POPUP ======================
function openModal() {
    el('modal').classList.remove('hidden');
    el('customerForm').elements.name.focus();
}

function closeModal() {
    el('modal').classList.add('hidden');
}

el('openAdd').addEventListener('click', openModal);
el('closeModal').addEventListener('click', closeModal);
el('cancelModal').addEventListener('click', closeModal);

el('modal').addEventListener('click', function (event) {
    if (event.target === el('modal')) closeModal();
});

document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeModal();
    if (event.key === 'Enter' && event.target.id === 'search') {
        event.preventDefault();
        el('findToken').click();
    }
});

el('customerForm').addEventListener('submit', function (event) {
    event.preventDefault(); // Stop normal HTML form page reload.
    const form = event.target;
    const name = form.elements.name.value;
    const service = form.elements.service.value;
    const priority = form.elements.priority.value;

    try {
        const customer = bank.addCustomer(name, service, priority);
        bank.save();
        render();
        closeModal();
        form.reset();
        toast('✓ Token ' + customer.token + ' generated successfully');
    } catch (error) {
        toast('⚠ ' + error.message);
    }
});

// ====================== 13. DEMO / UNDO / RESET ======================
el('seed').addEventListener('click', function () {
    if (bank.stats().total > 0 && !confirm('Replace existing customers with 12 demo customers?')) return;
    runAction(function () { bank.demo(); }, '12 demo customers loaded');
});

function undoLast() {
    runAction(function () { bank.undo(); }, 'Last operation undone');
}

el('undoCounter').addEventListener('click', undoLast);
el('undoVisual').addEventListener('click', undoLast);
el('undoHistory').addEventListener('click', undoLast);

el('reset').addEventListener('click', function () {
    if (!confirm('Reset all queues, counters and history?')) return;
    runAction(function () { bank.reset(); }, 'System reset');
});

el('refresh').addEventListener('click', function () {
    render();
    toast('Dashboard updated');
});

// ====================== 14. LIVE CLOCK + START ======================
function updateClock() {
    el('clock').textContent = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

setInterval(updateClock, 1000);
updateClock();
goToPage('overview');
render();
