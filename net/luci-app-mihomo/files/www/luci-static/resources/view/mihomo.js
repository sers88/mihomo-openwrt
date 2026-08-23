/* SPDX-License-Identifier: Apache-2.0 */
'use strict';
'require view';
'require poll';
'require rpc';
'require uci';
'require ui';

var callInitList = rpc.declare({
	object: 'luci',
	method: 'getInitList',
	params: [ 'name' ],
	expect: { '': {} }
});

var callInitAction = rpc.declare({
	object: 'luci',
	method: 'setInitAction',
	params: [ 'name', 'action' ],
	expect: { result: false }
});

var callLogRead = rpc.declare({
	object: 'log',
	method: 'read',
	params: [ 'lines' ],
	expect: { log: [] }
});

function initInfo(data) {
	var st = (data && (data.mihomo || data)) || {};
	return {
		running: !!st.running,
		enabled: !!st.enabled
	};
}

function statusBadge(text, ok) {
	return E('span', { 'class': 'ifacebadge' }, [
		E('span', { 'class': ok ? 'dot ok' : 'dot err' }, '\u00a0'),
		' ',
		text
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callInitList('mihomo'), {}),
			uci.load('mihomo')
		]);
	},

	handleAction: function(action, ev) {
		var self = this;
		return callInitAction('mihomo', action).then(function() {
			return self.refresh();
		});
	},

	handleAutostart: function(enable, ev) {
		var self = this;

		uci.set('mihomo', 'main', 'enabled', enable ? '1' : '0');

		return uci.save()
			.then(function() { return uci.apply(); })
			.then(function() {
				if (!enable)
					return callInitAction('mihomo', 'stop');
				return callInitAction('mihomo', 'restart');
			})
			.then(function() {
				return self.refresh();
			});
	},

	handleOpenDashboard: function(ev) {
		window.open('http://%s:9090/ui'.format(window.location.hostname), '_blank');
	},

	handleRefreshLog: function(ev) {
		return this.updateLog();
	},

	updateLog: function() {
		var el = document.getElementById('mihomo-log');

		return callLogRead(200).then(function(lines) {
			var filtered = (lines || []).filter(function(l) {
				return (l || '').indexOf('mihomo') >= 0;
			});

			if (!filtered.length)
				el.value = _('No mihomo entries in the system log yet.');
			else
				el.value = filtered.slice(-200).join('\n');
		}).catch(function() {
			el.value = _('Failed to read the system log.');
		});
	},

	render: function(data) {
		var st = initInfo(data[0]),
		    m = this;
		var enabled = uci.get('mihomo', 'main', 'enabled') === '1',
		    conffile = uci.get('mihomo', 'main', 'conffile') || '/etc/mihomo/config.yaml',
		    workdir = uci.get('mihomo', 'main', 'workdir') || '/usr/share/mihomo',
		    user = uci.get('mihomo', 'main', 'user') || 'root',
		    ifaces = uci.get('mihomo', 'main', 'ifaces');

		var logBox = E('textarea', {
			'id': 'mihomo-log',
			'class': 'cbi-input-textarea',
			'readonly': 'readonly',
			'rows': 15,
			'style': 'width:100%;font-family:monospace;white-space:pre;'
		}, _('Loading log ...'));

		var view = E('div', {}, [
			E('h2', {}, _('Mihomo')),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Status')),

				E('div', { 'style': 'display:flex;gap:2em;flex-wrap:wrap;margin-bottom:1em;' }, [
					E('div', {}, _('Running:') + ' ' + statusBadge(st.running ? _('yes') : _('no'), st.running)),
					E('div', {}, _('Autostart:') + ' ' + statusBadge(enabled ? _('enabled') : _('disabled'), enabled))
				]),

				E('div', { 'class': 'cbi-page-actions', 'style': 'text-align:left;' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(m, 'handleAction', 'start')
					}, _('Start')),
					' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-reset',
						'click': ui.createHandlerFn(m, 'handleAction', 'stop')
					}, _('Stop')),
					' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-reload',
						'click': ui.createHandlerFn(m, 'handleAction', 'restart')
					}, _('Restart')),
					' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-%s'.format(enabled ? 'negative' : 'positive'),
						'click': ui.createHandlerFn(m, 'handleAutostart', !enabled)
					}, enabled ? _('Disable autostart') : _('Enable autostart'))
				])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Web dashboard (metacubexd)')),
				E('div', {}, _('Manage proxies, rules and connections in the metacubexd dashboard. It is served by mihomo on the external-controller port (9090 by default); the login secret is set in the mihomo config file.')),
				E('div', { 'class': 'cbi-page-actions', 'style': 'text-align:left;margin-top:0.5em;' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(m, 'handleOpenDashboard')
					}, _('Open dashboard'))
				])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Service settings')),
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left', 'width': '25%' }, E('strong', {}, _('Config file'))),
						E('td', { 'class': 'td left' }, conffile)
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left' }, E('strong', {}, _('Working directory'))),
						E('td', { 'class': 'td left' }, workdir)
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left' }, E('strong', {}, _('Run as user'))),
						E('td', { 'class': 'td left' }, user)
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left' }, E('strong', {}, _('Restart triggers (interfaces)'))),
						E('td', { 'class': 'td left' }, Array.isArray(ifaces) ? ifaces.join(', ') : (ifaces || 'wan, wan_6'))
					])
				])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Log')),
				E('div', { 'class': 'cbi-page-actions', 'style': 'text-align:left;' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-reload',
						'click': ui.createHandlerFn(m, 'handleRefreshLog')
					}, _('Refresh'))
				]),
				E('div', { 'style': 'margin-top:0.5em;' }, [ logBox ])
			])
		]);

		m.updateLog();

		poll.add(L.bind(m.updateLog, m), 10);

		return view;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
