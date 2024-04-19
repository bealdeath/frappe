// Copyright (c) 2024, Frappe Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on("System Health Report", {
	onload(frm) {
		let poll_attempts = 0;
		const interval = setInterval(() => {
			frappe
				.xcall(
					"frappe.desk.doctype.system_health_report.system_health_report.get_job_status",
					{ job_id: frm.doc.test_job_id }
				)
				.then((status) => {
					poll_attempts += 1;
					if (["finished", "failed"].includes(status) || poll_attempts > 30) {
						clearInterval(interval);
					}
					status && frm.set_value("background_jobs_check", status);
				});
		}, 1000);
	},
	refresh(frm) {
		frm.set_value("socketio_ping_check", "Fail");
		frappe.realtime.on("pong", () => {
			frm.set_value("socketio_ping_check", "Pass");
			frm.set_value(
				"socketio_transport_mode",
				frappe.realtime.socket.io?.engine?.transport?.name
			);
		});
		frappe.realtime.emit("ping");
		frm.disable_save();
		frm.trigger("setup_highlight");
	},

	setup_highlight(frm) {
		/// field => is bad?
		const conditions = {
			scheduler_status: (val) => val.toLowerCase() != "active",
			background_jobs_check: (val) => val.toLowerCase() != "finished",
			total_background_workers: (val) => val == 0,
			binary_logging: (val) => val.toLowerCase() != "on",
			socketio_ping_check: (val) => val != "Pass",
			socketio_transport_mode: (val) => val != "websocket",
			onsite_backups: (val) => val == 0,
			failed_logins: (val) => val > frm.doc.total_users,
			total_errors: (val) => val > 100,
			// 5% excluding very small numbers
			unhandled_emails: (val) =>
				val > 3 && frm.doc.handled_emails > 3 && val / frm.doc.handled_emails > 0.05,
			failed_emails: (val) =>
				val > 3 &&
				frm.doc.total_outgoing_emails > 3 &&
				val / frm.doc.total_outgoing_emails > 0.05,
			pending_emails: (val) =>
				val > 3 &&
				frm.doc.total_outgoing_emails > 3 &&
				val / frm.doc.total_outgoing_emails > 0.1,
		};

		const style = document.createElement("style");
		style.innerText = ".health-check-failed { border: 1px solid var(--error-border); }";
		document.head.appendChild(style);

		const update_fields = () => {
			Object.entries(conditions).forEach(([field, condition]) => {
				try {
					let is_bad = condition(frm.doc[field]);
					let df = frm.fields_dict[field];
					$(df.disp_area).toggleClass("health-check-failed", is_bad);
				} catch (e) {
					console.log("Failed to evaluated", e);
				}
			});
		};

		update_fields();
		const interval = setInterval(update_fields, 1000);
	},
});
