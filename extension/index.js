/* globals select, empty, domify, parseHTML, OptionsSync, setTimeoutUntilVisible, elementReady */

let options;
let notifications;

class Notifications {
	constructor() {
		try {
			// Firefox bug requires location.origin
			// https://github.com/sindresorhus/refined-github/issues/489
			const url = options.participating ? '/notifications/participating' : '/notifications';
			this.dom = fetch(location.origin + url, {
				credentials: 'include'
			}).then(r => r.text()).then(parseHTML);
		} catch (err) {/* Ignore network failures */}
	}
	async getList() {
		if (!this.list) {
			this.list = select.all('.notifications-list .boxed-group', await this.dom);

			// Change tooltip direction
			for (const group of this.list) {
				for (const {classList} of select.all('.tooltipped-s', group)) {
					classList.replace('tooltipped-s', 'tooltipped-n');
				}
			}
		}
		return this.list;
	}
}

function getRefinedGitHubUnreadCount() {
	const element = select('[data-rgh-unread]');
	if (!element) {
		return 0;
	}
	return Number(element.dataset.rghUnread);
}

// Is the dropdown open? Is it opening?
function isOpen(el) {
	return select.exists('.NPG-opener[aria-expanded="true"], .NPG-loading', el);
}

async function updateUnreadCount() {
	const latestStatusEl = select('.notification-indicator .mail-status', await notifications.dom);
	const latestCount = select('.notification-center .selected .count', await notifications.dom).textContent;
	const rghCount = getRefinedGitHubUnreadCount();

	for (const statusEl of select.all('.notification-indicator .mail-status')) {
		if (options.previewCount && statusEl.textContent !== latestCount) {
			statusEl.textContent = Number(latestCount) + rghCount || ''; // Don't show 0
		}
		statusEl.classList.toggle('unread', rghCount || latestStatusEl.classList.contains('unread'));
		statusEl.parentNode.dataset.gaClick = latestStatusEl.parentNode.dataset.gaClick;
		statusEl.parentNode.setAttribute('aria-label', latestStatusEl.parentNode.getAttribute('aria-label'));
	}
}

function createNotificationsDropdown() {
	const indicators = select.all('a.notification-indicator');
	const participating = options.participating ? 'participating' : '';

	for (const indicator of indicators) {
		const dropdown = domify(`
			<div class="NPG-container js-menu-container">
				<div class="NPG-opener js-menu-target"></div>
				<div class="NPG dropdown-menu-content js-menu-content">
					<div class="NPG-dropdown dropdown-menu dropdown-menu-sw notifications-list ${participating} type-${options.dropdown}">
					</div>
				</div>
			</div>
		`);
		indicator.parentNode.prepend(dropdown);

		// Close dropdown if a link is clicked
		// https://github.com/tanmayrajani/notifications-preview-github/issues/50
		dropdown.addEventListener('click', event => {
			if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.target.closest('a[href]')) {
				select('.modal-backdrop').click();
			}
		});
		indicator.addEventListener('mouseenter', openDropdown);
		indicator.addEventListener('click', visitNotificationsPage);
	}
}

async function openDropdown({currentTarget: indicator}) {
	const dropdown = indicator.parentNode;
	indicator.classList.add('NPG-loading');
	const list = await notifications.getList();
	indicator.classList.remove('NPG-loading');

	if (!isOpen(dropdown) && list.length > 0) {
		const container = select('.NPG-dropdown', dropdown);
		empty(container);
		container.append(...list);
		select('.NPG-opener', dropdown).click(); // Open modal
	}
}

// When the dropdown is open, GitHub's modal blocks all links outside the dropdown.
// This handler lets the user visit /notifications while retaining any cmd/ctrl click modifier
function visitNotificationsPage(event) {
	if (isOpen() && event.isTrusted) {
		event.currentTarget.dispatchEvent(new MouseEvent('click', event));
	}
}

async function updateLoop() {
	if (!isOpen()) {
		const latest = new Notifications();
		// On the first run, set it asap so they can be awaited
		if (!notifications) {
			notifications = latest;
		}
		await latest.dom;
		notifications = latest;
		updateUnreadCount();
	}

	setTimeoutUntilVisible(updateLoop, 3000);
}

async function init() {
	options = await new OptionsSync().getAll();
	await elementReady('.notification-indicator');
	updateLoop();

	if (!location.pathname.startsWith('/notifications') && options.dropdown !== 'no') {
		createNotificationsDropdown();
	}
}

init();
