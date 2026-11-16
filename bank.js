/*
   ==============================================================
   BANK.JS = OUR "BACKEND LOGIC" (runs inside the browser)
   ============================================================== 
   This file contains the REAL DATA STRUCTURES and BANK RULES.
   No Node.js, no database, no API calls, no libraries.

   HOW TO READ THIS FILE:
   1. Node        = one linked-list node
   2. LinkedQueue = FIFO, using Node (HEAD -> ... -> TAIL)
   3. Stack       = LIFO, using Node (TOP -> ... -> NULL)
   4. Bank        = customer tokens, counters, search, sort, undo
*/

// A node stores customer data and the address of the next node.
class Node {
    constructor(value) {
        this.value = value;
        this.next = null;
    }
}

// ===================== 1. LINKED LIST + QUEUE =====================
class LinkedQueue {
    constructor() {
        this.head = null;  // First person
        this.tail = null;  // Last person
        this.count = 0;
    }

    // ENQUEUE: Add a customer at the end. O(1)
    enqueue(value) {
        const node = new Node(value);
        if (this.head === null) {
            this.head = node;
        } else {
            this.tail.next = node;
        }
        this.tail = node;
        this.count++;
    }

    // Add at front only when Undo returns a called customer. O(1)
    enqueueFront(value) {
        const node = new Node(value);
        node.next = this.head;
        this.head = node;
        if (this.tail === null) this.tail = node;
        this.count++;
    }

    // DEQUEUE: Remove first customer. O(1)
    dequeue() {
        if (this.head === null) return null;

        const customer = this.head.value;
        this.head = this.head.next;
        if (this.head === null) this.tail = null;
        this.count--;
        return customer;
    }

    // LINEAR SEARCH: Start at head, visit nodes one by one. O(n)
    findToken(token) {
        let current = this.head;
        while (current !== null) {
            if (current.value.token === token) return current.value;
            current = current.next;
        }
        return null;
    }

    // DELETE: Remove a particular token from linked list. O(n)
    removeToken(token) {
        let current = this.head;
        let previous = null;

        while (current !== null) {
            if (current.value.token === token) {
                if (previous === null) this.head = current.next;
                else previous.next = current.next;

                if (current === this.tail) this.tail = previous;
                this.count--;
                return current.value;
            }
            previous = current;
            current = current.next;
        }
        return null;
    }

    // Convert nodes into an array ONLY to display them in HTML.
    toArray() {
        const customers = [];
        let current = this.head;
        while (current !== null) {
            customers.push(current.value);
            current = current.next;
        }
        return customers;
    }
}

// ===================== 2. LINKED-LIST STACK =====================
class Stack {
    constructor() {
        this.top = null;
        this.count = 0;
    }

    // PUSH: Add latest operation to top. O(1)
    push(value) {
        const node = new Node(value);
        node.next = this.top;
        this.top = node;
        this.count++;
    }

    // PEEK: Look at latest operation. O(1)
    peek() {
        if (this.top === null) return null;
        return this.top.value;
    }

    // POP: Remove the latest operation. O(1)
    pop() {
        if (this.top === null) return null;
        const operation = this.top.value;
        this.top = this.top.next;
        this.count--;
        return operation;
    }

    // Only for showing / saving the stack; TOP element is first.
    toArray() {
        const values = [];
        let current = this.top;
        while (current !== null) {
            values.push(current.value);
            current = current.next;
        }
        return values;
    }
}

// ===================== 3. BANK CONFIGURATION =====================
const SERVICES = [
    { id: 'deposit', name: 'Cash Deposit', code: 'D', minutes: 4, color: '#31b99c', icon: '↙' },
    { id: 'withdrawal', name: 'Withdrawal', code: 'W', minutes: 3, color: '#8e80ee', icon: '↗' },
    { id: 'account', name: 'Account Services', code: 'A', minutes: 7, color: '#e7a65a', icon: '▣' },
    { id: 'loans', name: 'Loans & Enquiries', code: 'L', minutes: 9, color: '#5e9cfa', icon: '◇' }
];

// ===================== 4. BANK OPERATIONS =====================
class Bank {
    constructor() {
        this.reset();
        this.load(); // Restore earlier work after refreshing browser.
    }

    reset() {
        this.queues = {};
        // For every service: 2 linked-list queues.
        // PRIORITY QUEUE is served first. Each queue is FIFO.
        for (const service of SERVICES) {
            this.queues[service.id] = {
                priority: new LinkedQueue(),
                regular: new LinkedQueue()
            };
        }

        // Four service counters: one per service.
        this.counters = [];
        for (let i = 0; i < SERVICES.length; i++) {
            this.counters.push({
                id: i + 1,
                name: 'Counter 0' + (i + 1),
                service: SERVICES[i].id,
                current: null,
                paused: false
            });
        }

        this.undoStack = new Stack();
        this.history = [];
        this.events = [];
        this.serial = 0;
        this.completed = 0;
    }

    getService(serviceId) {
        for (const service of SERVICES) {
            if (service.id === serviceId) return service;
        }
        return null;
    }

    getCounter(id) {
        for (const counter of this.counters) {
            if (counter.id === Number(id)) return counter;
        }
        throw new Error('Counter not found');
    }

    log(type, message) {
        this.events.unshift({ type: type, message: message, time: Date.now() });
        if (this.events.length > 35) this.events.pop();
    }

    // A. GENERATE TOKEN + ENQUEUE
    addCustomer(name, serviceId, category) {
        name = name.trim();
        if (!name) throw new Error('Enter customer name');
        if (name.length > 55) throw new Error('Name is too long');

        const service = this.getService(serviceId);
        if (service === null) throw new Error('Choose a valid service');
        if (category !== 'regular' && category !== 'senior' && category !== 'accessible') {
            throw new Error('Choose a valid customer category');
        }

        this.serial++;
        const number = String(this.serial).padStart(3, '0');
        const customer = {
            token: service.code + '-' + number,
            name: name,
            service: serviceId,
            priority: category,
            createdAt: Date.now(),
            calledAt: null,
            completedAt: null
        };

        if (category === 'regular') {
            this.queues[serviceId].regular.enqueue(customer);
        } else {
            this.queues[serviceId].priority.enqueue(customer);
        }
        this.log('add', customer.token + ' joined ' + service.name);
        return customer;
    }

    // B. CALL NEXT: DEQUEUE from priority first, otherwise regular.
    callNext(counterId) {
        const counter = this.getCounter(counterId);
        if (counter.paused) throw new Error('Counter is paused');
        if (counter.current !== null) throw new Error('Complete the current customer first');

        const group = this.queues[counter.service];
        let customer = group.priority.dequeue();
        if (customer === null) customer = group.regular.dequeue();
        if (customer === null) throw new Error('No customers waiting for this service');

        customer.calledAt = Date.now();
        counter.current = customer;
        this.undoStack.push({ action: 'call', counterId: counter.id, token: customer.token });
        this.log('call', customer.token + ' called to ' + counter.name);
        return customer;
    }

    // C. COMPLETE: Move a serving customer into completed history.
    complete(counterId) {
        const counter = this.getCounter(counterId);
        if (counter.current === null) throw new Error('No customer is being served');

        const customer = counter.current;
        customer.completedAt = Date.now();
        counter.current = null;
        this.completed++;
        this.history.unshift({ ...customer, counterId: counter.id });
        this.undoStack.push({ action: 'complete', counterId: counter.id, customer: { ...customer } });
        this.log('complete', customer.token + ' completed service');
        return customer;
    }

    // D. SEARCH: Look for token in all linked queues.
    findCustomer(token) {
        token = token.trim().toUpperCase();
        for (const service of SERVICES) {
            const group = this.queues[service.id];
            let customer = group.priority.findToken(token);
            if (customer === null) customer = group.regular.findToken(token);
            if (customer !== null) return customer;
        }
        return null;
    }

    // E. REMOVE: Delete token from a linked list.
    removeCustomer(token) {
        for (const service of SERVICES) {
            const group = this.queues[service.id];
            let customer = group.priority.removeToken(token);
            if (customer === null) customer = group.regular.removeToken(token);
            if (customer !== null) {
                this.log('remove', token + ' removed from queue');
                return customer;
            }
        }
        throw new Error('Waiting token not found');
    }

    // F. PAUSE / RESUME
    toggleCounter(counterId) {
        const counter = this.getCounter(counterId);
        if (counter.current !== null) throw new Error('Complete the current service first');
        counter.paused = !counter.paused;
        this.log('counter', counter.name + (counter.paused ? ' paused' : ' resumed'));
    }

    // G. UNDO: STACK POP = Reverse the latest call or completion.
    undo() {
        const last = this.undoStack.peek();
        if (last === null) throw new Error('No operations to undo');

        const counter = this.getCounter(last.counterId);
        if (last.action === 'call') {
            // Put the serving customer back at the HEAD of their queue.
            if (counter.current === null || counter.current.token !== last.token) {
                throw new Error('Cannot undo: counter changed');
            }
            const customer = counter.current;
            customer.calledAt = null;
            counter.current = null;
            if (customer.priority === 'regular') {
                this.queues[customer.service].regular.enqueueFront(customer);
            } else {
                this.queues[customer.service].priority.enqueueFront(customer);
            }
            this.log('undo', 'Call for ' + customer.token + ' undone');
        } else {
            // Restore the last completed customer to their counter.
            if (counter.current !== null) throw new Error('Cannot undo: counter occupied');
            const customer = last.customer;
            customer.completedAt = null;
            counter.current = customer;
            this.completed--;
            for (let i = 0; i < this.history.length; i++) {
                if (this.history[i].token === customer.token) {
                    this.history.splice(i, 1);
                    break;
                }
            }
            this.log('undo', 'Completion for ' + customer.token + ' undone');
        }
        this.undoStack.pop();
    }

    // H. ALL WAITING CUSTOMERS: Used by dashboard.
    getWaiting() {
        const customers = [];
        for (const service of SERVICES) {
            const group = this.queues[service.id];
            for (const person of group.priority.toArray()) customers.push(person);
            for (const person of group.regular.toArray()) customers.push(person);
        }
        return customers;
    }

    // I. INSERTION SORT: Rank services from busiest to least busy.
    rankedServices() {
        const sorted = SERVICES.slice();
        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            const currentCount = this.waitingCount(current.id);
            let j = i - 1;
            while (j >= 0 && this.waitingCount(sorted[j].id) < currentCount) {
                sorted[j + 1] = sorted[j];
                j--;
            }
            sorted[j + 1] = current;
        }
        return sorted;
    }

    waitingCount(serviceId) {
        const group = this.queues[serviceId];
        return group.priority.count + group.regular.count;
    }

    // J. STATISTICS (only simple loops and arithmetic).
    stats() {
        const waiting = this.getWaiting().length;
        let serving = 0;
        let totalMinutes = 0;
        for (const counter of this.counters) {
            if (counter.current !== null) serving++;
        }
        for (const service of SERVICES) {
            totalMinutes += this.waitingCount(service.id) * service.minutes;
        }
        return {
            waiting: waiting,
            serving: serving,
            completed: this.completed,
            total: waiting + serving + this.completed,
            avgWait: waiting === 0 ? 0 : Math.round(totalMinutes / SERVICES.length)
        };
    }

    // K. 12 EXAMPLE CUSTOMERS (for your demonstration).
    demo() {
        this.reset();
        const samples = [
            ['Aarav Patel', 'deposit', 'regular'],
            ['Diya Shah', 'withdrawal', 'regular'],
            ['Meera Desai', 'account', 'senior'],
            ['Rohan Mehta', 'deposit', 'regular'],
            ['Kavya Joshi', 'loans', 'regular'],
            ['Ishaan Trivedi', 'withdrawal', 'accessible'],
            ['Nisha Patel', 'deposit', 'senior'],
            ['Dev Shah', 'account', 'regular'],
            ['Priya Sharma', 'loans', 'senior'],
            ['Harsh Vyas', 'withdrawal', 'regular'],
            ['Anaya Mehta', 'deposit', 'regular'],
            ['Krish Patel', 'account', 'regular']
        ];
        for (const sample of samples) {
            this.addCustomer(sample[0], sample[1], sample[2]);
        }
        this.log('demo', '12 sample customers loaded');
    }

    /*
       OPTIONAL BROWSER STORAGE: not a database.
       Save plain values to localStorage so refreshing the page does NOT
       erase your viva/demo session. We rebuild linked nodes on load.
    */
    save() {
        const savedQueues = {};
        for (const service of SERVICES) {
            savedQueues[service.id] = {
                priority: this.queues[service.id].priority.toArray(),
                regular: this.queues[service.id].regular.toArray()
            };
        }
        const data = {
            queues: savedQueues,
            counters: this.counters,
            history: this.history,
            events: this.events,
            serial: this.serial,
            completed: this.completed,
            stack: this.undoStack.toArray()
        };
        try {
            localStorage.setItem('queueos-simple', JSON.stringify(data));
        } catch (error) {
            // Even when browser storage is disabled, the app still works.
        }
    }

    load() {
        try {
            const text = localStorage.getItem('queueos-simple');
            if (!text) return;
            const data = JSON.parse(text);
            this.reset();
            this.serial = data.serial;
            this.completed = data.completed;
            this.counters = data.counters;
            this.history = data.history;
            this.events = data.events;

            for (const service of SERVICES) {
                const old = data.queues[service.id];
                for (const customer of old.priority) {
                    this.queues[service.id].priority.enqueue(customer);
                }
                for (const customer of old.regular) {
                    this.queues[service.id].regular.enqueue(customer);
                }
            }
            // Stored list is TOP-first; push in reverse to restore it.
            for (let i = data.stack.length - 1; i >= 0; i--) {
                this.undoStack.push(data.stack[i]);
            }
        } catch (error) {
            this.reset(); // Ignore damaged / unavailable local storage.
        }
    }
}

// This ONE object is used everywhere by app.js.
const bank = new Bank();
