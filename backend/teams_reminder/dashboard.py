"""
Fanam Teams Reminder Agent — Streamlit Dashboard
Run: streamlit run dashboard.py
Requires api.py running on port 8000 (uvicorn api:app --reload --port 8000)
"""

import os
from datetime import datetime

import pandas as pd
import requests
import streamlit as st
import plotly.express as px
from dotenv import load_dotenv

load_dotenv()

def load_employees():
    try:
        # Resolve path relative to this file so it works from any working directory
        _here = os.path.dirname(os.path.abspath(__file__))
        master_path = os.path.join(_here, "Employee Master Sheet .xlsx")
        if not os.path.exists(master_path):
            return []
        df = pd.read_excel(master_path, sheet_name="Emp_Info")
        df = df[df['Active?'].astype(str).str.strip().str.lower() == 'yes']
        return df[['Employee Name', 'Official Email', 'Department', 'Date of Joining']].dropna(subset=['Employee Name']).to_dict(orient='records')
    except Exception as e:
        return []


API_BASE = os.getenv("API_BASE_URL", "http://127.0.0.1:8000/api/teams")

CATEGORY_COLORS = {
    "overdue": "#c0392b",
    "due_today": "#e67e22",
    "yet_to_start": "#2980b9",
    "in_progress": "#27ae60",
    "completed_or_other": "#95a5a6",
}

CATEGORY_LABELS = {
    "overdue": "Overdue",
    "due_today": "Due Today",
    "yet_to_start": "Yet to Start",
    "in_progress": "In Progress",
    "completed_or_other": "Completed / Other",
}


def api_get(path: str, **params):
    try:
        r = requests.get(f"{API_BASE}{path}", params=params, timeout=60)
        r.raise_for_status()
        return r.json(), None
    except Exception as e:
        return None, str(e)


def api_post(path: str, **params):
    try:
        r = requests.post(f"{API_BASE}{path}", params=params, timeout=120)
        r.raise_for_status()
        return r.json(), None
    except Exception as e:
        detail = str(e)
        try:
            detail = r.json().get("detail", detail)
        except Exception:
            pass
        return None, detail


def api_post_json(path: str, json_body: dict):
    try:
        r = requests.post(f"{API_BASE}{path}", json=json_body, timeout=120)
        r.raise_for_status()
        return r.json(), None
    except Exception as e:
        detail = str(e)
        try:
            detail = r.json().get("detail", detail)
        except Exception:
            pass
        return None, detail


def clean_df_for_display(df: pd.DataFrame) -> pd.DataFrame:
    df_clean = df.astype(str)
    for val in ("nan", "None", "<NA>", "NaN", "NaT"):
        df_clean = df_clean.replace(val, "")
    return df_clean


def badge(category: str) -> str:
    color = CATEGORY_COLORS.get(category, "#555")
    label = CATEGORY_LABELS.get(category, category.replace("_", " ").title())
    return f'<span style="background:{color};color:white;padding:2px 8px;border-radius:4px;font-size:12px;">{label}</span>'


def check_api():
    data, err = api_get("/health")
    return data is not None, err


# ── Page config ──
st.set_page_config(
    page_title="Fanam Teams Reminder",
    page_icon="💬",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    .block-container { padding-top: 1.5rem; }
    div[data-testid="stMetric"] {
        background: #f8f9fb;
        border: 1px solid #e8eaed;
        border-radius: 8px;
        padding: 12px 16px;
    }
    .teams-header {
        background: linear-gradient(135deg, #6264A7 0%, #464775 100%);
        color: white;
        padding: 1.25rem 1.5rem;
        border-radius: 10px;
        margin-bottom: 1.5rem;
    }
    .teams-header h1 { color: white; margin: 0; font-size: 1.6rem; }
    .teams-header p { color: rgba(255,255,255,0.85); margin: 0.4rem 0 0; }
</style>
""", unsafe_allow_html=True)

# ── Sidebar ──
with st.sidebar:
    st.title("⚙️ Controls")
    st.caption(f"API: `{API_BASE}`")

    ok, err = check_api()
    if ok:
        st.success("API connected")
    else:
        st.error(f"API offline — start with `uvicorn api:app --port 8000`")
        if err:
            st.caption(err)

    st.divider()
    st.subheader("⚡ Scheduled Trigger Manual Tests")

    if st.button("🚀 Test Morning Reminders (10:00 AM IST)", use_container_width=True, disabled=not ok):
        st.toast("Morning Reminders execution started in background!")
        with st.spinner("Triggering..."):
            result, err = api_post("/send-reminders")
        if err:
            st.error(err)
        else:
            st.success("Morning Reminders check triggered. Check the 'Activity log' tab for details.")

    if st.button("📊 Test PM Unassigned Report (10:20 AM IST)", use_container_width=True, disabled=not ok):
        st.toast("PM Unassigned Report execution started in background!")
        with st.spinner("Triggering..."):
            result, err = api_post("/reports/unassigned")
        if err:
            st.error(err)
        else:
            st.success("PM Unassigned Report run triggered. Check the 'Activity log' tab for details.")

    if st.button("🔄 Test Real-Time Allocation Poll (2-min loop)", use_container_width=True, disabled=not ok):
        st.toast("Real-Time Allocation Poll execution started in background!")
        with st.spinner("Triggering..."):
            result, err = api_post("/poll-allocations")
        if err:
            st.error(err)
        else:
            st.success("Real-Time Allocation Poll triggered. Check the 'Activity log' tab for details.")

    if st.button("💬 Test Teams Reply Poller & AI Sync", use_container_width=True, disabled=not ok):
        st.toast("Teams Reply Poller & AI Sync execution started in background!")
        with st.spinner("Triggering..."):
            result, err = api_post("/teams/poll-replies/background")
        if err:
            st.error(err)
        else:
            st.success("Reply polling & AI sync triggered. Check the 'Activity log' tab for details.")

    if st.button("📧 Test Directors' EOD Summary (05:30 PM IST)", use_container_width=True, disabled=not ok):
        st.toast("Directors' EOD Summary execution started in background!")
        with st.spinner("Triggering..."):
            result, err = api_post("/reports/eod-directors")
        if err:
            st.error(err)
        else:
            st.success("Directors' EOD Summary report triggered. Check the 'Activity log' tab for details.")

    if st.button("📊 Run Resource Utilization Analysis (R-04)", use_container_width=True, disabled=not ok):
        st.toast("Resource Utilization Analysis execution started in background!")
        with st.spinner("Triggering..."):
            result, err = api_post("/reports/utilization")
        if err:
            st.error(err)
        else:
            st.success("Resource Utilization report triggered successfully. Check the 'Activity log' tab for details.")

    if st.button("📋 Run Weekly Project Status & Risk Report (REQ-H01 & H02)", use_container_width=True, disabled=not ok):
        st.toast("Weekly Status & Risk report execution started in background!")
        with st.spinner("Triggering..."):
            result, err = api_post("/reports/weekly-status")
        if err:
            st.error(err)
        else:
            st.success("Weekly Status & Risk report triggered successfully. Check the 'Activity log' tab for details.")

    st.divider()
    st.subheader("🔧 Diagnostics & Utilities")
    test_email = st.text_input("Test recipient email", placeholder="you@company.com")
    if st.button("💬 Send test Teams message", use_container_width=True, disabled=not ok):
        params = {"recipient_email": test_email} if test_email else {}
        with st.spinner("Sending test..."):
            result, err = api_post("/teams/test", **params)
        if err:
            st.error(err)
        else:
            st.success(f"Test sent to {result.get('recipient_email', test_email)}")

    if st.button("📁 Test SharePoint sync", use_container_width=True, disabled=not ok):
        with st.spinner("Fetching..."):
            result, err = api_post("/sharepoint/test")
        if err:
            st.error(err)
        else:
            st.success(f"Downloaded {result.get('bytes_downloaded', 0):,} bytes")

    if st.button("🔑 Test Teams Token Expiry Check", use_container_width=True, disabled=not ok):
        with st.spinner("Checking cache token..."):
            result, err = api_post("/teams/test-token-check")
        if err:
            st.error(err)
        else:
            status = result.get("status", "unknown")
            if status == "ok":
                st.success("Token cache active and healthy!")
            elif status == "warning":
                st.warning(f"Preemptive Warning! Cache last refreshed {result.get('days')} days ago (warning email sent to Nehasri@FANAMDIGITAL.COM).")
            else:
                st.error(f"Token expired or failed: {result.get('error')} (expiry warning email sent to Nehasri@FANAMDIGITAL.COM).")

    st.divider()
    if ok:
        cfg, _ = api_get("/config")
        sched, _ = api_get("/scheduler/status")
        if cfg:
            if cfg.get("sharepoint_share_url"):
                st.link_button("🌐 Open Live SharePoint Excel", cfg["sharepoint_share_url"], use_container_width=True)
                st.caption("")
            st.subheader("Schedule")
            morning_utc = cfg.get("morning_time_utc", "—")
            morning_ist = cfg.get("morning_time_ist", "—")
            pm_utc = cfg.get("pm_report_time_utc", "—")
            pm_ist = cfg.get("pm_report_time_ist", "—")
            evening_utc = cfg.get("evening_time_utc", "—")
            evening_ist = cfg.get("evening_time_ist", "—")
            dir_utc = cfg.get("directors_report_time_utc", "—")
            dir_ist = cfg.get("directors_report_time_ist", "—")
            
            st.write(f"**Morning Reminder:** {morning_ist} IST")
            st.write(f"**PM Unassigned:** {pm_ist} IST")
            st.write(f"**Evening Check-in:** {evening_ist} IST")
            st.write(f"**Directors EOD:** {dir_ist} IST")
            st.write(f"**Poll replies:** every {cfg.get('reply_poll_minutes', '—')} min")
            st.write(f"**Check new tasks:** every {cfg.get('new_task_check_minutes', '—')} min")
            st.write(f"**PM Email:** {cfg.get('pm_email') or '—'}")
            st.write(f"**Sender:** {cfg.get('teams_sender_email') or '—'}")
            test_info = []
            if cfg.get("test_mode_teams"):
                test_info.append("Teams DM")
            if cfg.get("test_mode_pm"):
                test_info.append("PM Email")
            if cfg.get("test_mode_directors"):
                test_info.append("Directors Email")
                
            if test_info:
                st.warning(f"TESTING ({', '.join(test_info)}) → {cfg.get('test_teams_email')}")
        if sched:
            st.caption("Scheduler: " + ("🟢 Running" if sched.get("running") else "🔴 Stopped"))
            for nr in sched.get("next_runs", [])[:3]:
                st.caption(f"Next: {nr}")

    if st.button("🔄 Refresh data", use_container_width=True):
        st.rerun()


# ── Header ──
st.markdown("""
<div class="teams-header">
  <h1>💬 Fanam Teams Reminder Agent</h1>
  <p>Automated Teams messages at 10:00 AM & 5:00 PM IST · Employee replies saved to SharePoint Remarks</p>
</div>
""", unsafe_allow_html=True)

if not ok:
    st.stop()

# ── Load data ──
summary, _ = api_get("/summary")
pending_data, _ = api_get("/tasks/pending")
history_data, _ = api_get("/reminder-history", limit=50)
replied_data, _ = api_get("/replied-history", limit=50)
awaiting_data, _ = api_get("/pending-replies")
logs_data, _ = api_get("/logs", limit=80)

pending_tasks = pending_data.get("tasks", []) if pending_data else []
by_cat = summary.get("by_category", {}) if summary else {}

# ── Metrics ──
c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("Total tasks (sheet rows)", summary.get("total_tasks", 0) if summary else "—")
c2.metric("Pending reminders today", pending_data.get("count", 0) if pending_data else 0)
c3.metric("Overdue", by_cat.get("overdue", 0))
c4.metric("Due today", by_cat.get("due_today", 0))
c5.metric("Awaiting Teams reply", len(awaiting_data.get("pending", [])) if awaiting_data else 0)

st.divider()

# ── Tabs ──
tab_pending, tab_all, tab_utilization, tab_evaluation, tab_targets, tab_history, tab_replies, tab_sprint_delays, tab_executive_summary, tab_logs, tab_excel, tab_config = st.tabs([
    "📋 Pending today",
    "📊 All tasks",
    "📊 Resource Utilization",
    "👥 Employee Evaluation",
    "🎯 Milestones & Targets",
    "📤 Reminder history",
    "💬 Teams replies",
    "⚠️ Sprint Missed Deadlines",
    "👔 Executive Summary",
    "📝 Activity log",
    "📁 Live Excel Viewer",
    "⚙️ Config",
])

with tab_pending:
    st.subheader("Tasks that will trigger a Teams reminder today")
    if not pending_tasks:
        st.info("No pending reminders for today — all caught up!")
    else:
        rows = []
        for t in pending_tasks:
            rows.append({
                "Category": t.get("category", ""),
                "Assignee": t.get("assignee", ""),
                "Project": t.get("project", ""),
                "Task": t.get("task", ""),
                "Module": t.get("module", ""),
                "Status": t.get("status", ""),
                "ETA": t.get("eta_str", ""),
                "Email": t.get("email_from_excel") or "—",
                "Remarks": t.get("remarks", ""),
            })
        df = pd.DataFrame(rows)

        f1, f2, f3 = st.columns(3)
        with f1:
            cat_filter = st.multiselect(
                "Filter category",
                options=sorted(df["Category"].unique()),
                default=list(df["Category"].unique()),
            )
        with f2:
            assignee_filter = st.text_input("Filter assignee (contains)")
        with f3:
            project_filter = st.text_input("Filter project (contains)")

        filtered = df[df["Category"].isin(cat_filter)]
        if assignee_filter:
            filtered = filtered[filtered["Assignee"].str.contains(assignee_filter, case=False, na=False)]
        if project_filter:
            filtered = filtered[filtered["Project"].str.contains(project_filter, case=False, na=False)]

        st.caption(f"Showing {len(filtered)} of {len(df)} tasks")
        for _, row in filtered.iterrows():
            cat = row["Category"]
            st.markdown(
                f"{badge(cat)} &nbsp; **{row['Assignee']}** · {row['Project']} · {row['Task'] or '—'} "
                f"· ETA: {row['ETA']} · {row['Status']}",
                unsafe_allow_html=True,
            )
            if row["Email"] == "—":
                st.warning(f"No email for {row['Assignee']} — Teams message will be skipped", icon="⚠️")

        with st.expander("View as table"):
            st.dataframe(clean_df_for_display(filtered), use_container_width=True, hide_index=True)

with tab_all:
    st.subheader("All tasks from SharePoint")
    af1, af2, af3 = st.columns(3)
    with af1:
        p_filter = st.text_input("Project contains", key="all_proj")
    with af2:
        a_filter = st.text_input("Assignee contains", key="all_assignee")
    with af3:
        s_filter = st.text_input("Status contains", key="all_status")

    params = {}
    if p_filter:
        params["project"] = p_filter
    if a_filter:
        params["assignee"] = a_filter
    if s_filter:
        params["status"] = s_filter

    all_data, err = api_get("/tasks", **params)
    if err:
        st.error(err)
    elif all_data:
        tasks = all_data.get("tasks", [])
        st.caption(f"{all_data.get('count', 0)} tasks")
        if tasks:
            today = datetime.now().date()
            table_rows = []
            for t in tasks:
                eta = t.get("eta")
                cat = None
                if pending_data:
                    for pt in pending_tasks:
                        if pt.get("row_id") == t.get("row_id") and pt.get("assignee") == t.get("assignee"):
                            cat = pt.get("category")
                            break
                table_rows.append({
                    "Assignee": t.get("assignee"),
                    "Project": t.get("project"),
                    "Task": t.get("task"),
                    "Module": t.get("module"),
                    "Status": t.get("status"),
                    "ETA": t.get("eta_str"),
                    "Email": t.get("email_from_excel") or "—",
                    "Remarks": t.get("remarks"),
                    "Reminder category": cat or "—",
                })
            st.dataframe(clean_df_for_display(pd.DataFrame(table_rows)), use_container_width=True, hide_index=True)

        if summary and summary.get("by_project"):
            st.subheader("Breakdown by project")
            proj_rows = []
            for proj, cats in summary["by_project"].items():
                for cat, count in cats.items():
                    proj_rows.append({"Project": proj, "Category": CATEGORY_LABELS.get(cat, cat), "Count": count})
            st.dataframe(pd.DataFrame(proj_rows), use_container_width=True, hide_index=True)

with tab_utilization:
    st.subheader("📊 Resource Utilization & PM Analytics (R-04 & R-05)")
    st.caption("Parses task estimates and computes weekly developer load based on a standard 40-hour capacity.")
    
    with st.spinner("Fetching utilization data..."):
        util_data, util_err = api_get("/reports/utilization/data")
        
    if util_err:
        st.error(f"Failed to fetch utilization data: {util_err}")
    elif util_data:
        summary_info = util_data.get("summary", {})
        dev_list = util_data.get("dev_utilization", [])
        
        # Display Metric Tiles
        col1, col2, col3 = st.columns(3)
        col1.metric("Total Team Allocated Hours", f"{summary_info.get('total_team_hours', 0)} hrs")
        col2.metric("Team Average Efficiency", f"{summary_info.get('avg_efficiency', 0)}%")
        col3.metric("Available Bench Capacity", f"{summary_info.get('free_capacity', 0)} hrs")
        
        st.divider()
        st.subheader("Developer Workload Breakdown")
        
        # Render a premium styled HTML table for workload breakdown
        table_html = """
        <table style="width:100%; border-collapse: collapse; font-family: 'Segoe UI', sans-serif; font-size: 14px;">
          <thead>
            <tr style="background-color: #f0f2f6; border-bottom: 2px solid #ddd; text-align: left;">
              <th style="padding: 12px; font-weight: bold; color: #333;">Developer</th>
              <th style="padding: 12px; font-weight: bold; color: #333;">Email</th>
              <th style="padding: 12px; font-weight: bold; color: #333; text-align: center;">Active Tasks</th>
              <th style="padding: 12px; font-weight: bold; color: #333; text-align: center;">Allocated Hours</th>
              <th style="padding: 12px; font-weight: bold; color: #333; text-align: center;">Utilization Rate</th>
              <th style="padding: 12px; font-weight: bold; color: #333; text-align: center;">Status</th>
              <th style="padding: 12px; font-weight: bold; color: #333;">PM Recommendations</th>
            </tr>
          </thead>
          <tbody>
        """
        for dev in sorted(dev_list, key=lambda x: -x["utilization_pct"]):
            badge_style = f"background-color: {dev['bg_color']}; color: {dev['color']}; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 12px; display: inline-block; text-align: center;"
            table_html += f"""
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px; font-weight: bold;">{dev['assignee']}</td>
              <td style="padding: 12px; color: #555;">{dev['email'] or '—'}</td>
              <td style="padding: 12px; text-align: center; font-weight: bold;">{dev['task_count']}</td>
              <td style="padding: 12px; text-align: center; font-weight: bold; color: #2b5c8f;">{dev['allocated_hours']} hrs</td>
              <td style="padding: 12px; text-align: center; font-weight: bold; color: #1b5e20;">{dev['utilization_pct']}%</td>
              <td style="padding: 12px; text-align: center;"><span style="{badge_style}">{dev['status']}</span></td>
              <td style="padding: 12px; color: #555; font-size: 13px;">{dev['pm_note']}</td>
            </tr>
            """
        table_html += "</tbody></table>"
        st.markdown(table_html, unsafe_allow_html=True)
        st.caption("💡 **Status thresholds:** Overloaded (>100%), Optimal (80% - 100%), Under-Allocated (<80%) based on 40 hrs/week capacity.")

with tab_evaluation:
    st.subheader("👥 Employee Performance & Skills Evaluation")
    
    # Load all active employees
    employees = load_employees()
    if not employees:
        st.info("No active employees found in the Master Excel file.")
    else:
        employee_names = [e["Employee Name"] for e in employees]
        selected_emp = st.selectbox("Select Employee to Evaluate", sorted(employee_names))
        
        # Find employee metadata
        emp_meta = next((e for e in employees if e["Employee Name"] == selected_emp), {})
        
        col_m1, col_m2, col_m3 = st.columns(3)
        col_m1.markdown(f"**Department:** {emp_meta.get('Department', '\u2014')}")
        col_m2.markdown(f"**Email:** {emp_meta.get('Official Email', '\u2014')}")
        col_m3.markdown(f"**Date of Joining:** {emp_meta.get('Date of Joining', '\u2014')}")
        
        st.divider()
        
        # ── Load tasks for this employee ──
        emp_tasks_data, err = api_get("/tasks", assignee=selected_emp)
        emp_tasks = emp_tasks_data.get("tasks", []) if emp_tasks_data else []
        
        # ── Compute all stats in one loop ──
        total_tasks = len(emp_tasks)
        completed_count = 0
        in_progress_count = 0
        blocked_count = 0
        yet_to_start_count = 0
        backlogs = 0
        on_time_completed = 0
        overdue_days_list = []
        status_categories = []
        proj_map = {}           # {project: {cat: count}}
        today_date = datetime.now().date()

        for t in emp_tasks:
            status_lower = str(t.get("status", "")).lower().strip()
            eta_str = t.get("eta", "")
            proj = t.get("project", "Unknown")

            is_done = any(kw in status_lower for kw in
                         ("complete", "done", "closed", "resolved", "100%", "90%"))

            # Status category
            if is_done:
                completed_count += 1
                cat = "Completed"
            elif any(kw in status_lower for kw in ("progress", "wip", "active", "doing")):
                in_progress_count += 1
                cat = "In Progress"
            elif any(kw in status_lower for kw in ("block", "hold")):
                blocked_count += 1
                cat = "Blocked"
            else:
                yet_to_start_count += 1
                cat = "Yet to Start"
            status_categories.append(cat)

            # ETA analysis
            if eta_str:
                try:
                    eta_dt = datetime.strptime(eta_str, "%Y-%m-%d").date()
                    if not is_done and eta_dt < today_date:
                        backlogs += 1
                        overdue_days_list.append((today_date - eta_dt).days)
                    if is_done and eta_dt >= today_date:
                        # Completed and ETA is still in the future or today — on-time
                        on_time_completed += 1
                except Exception:
                    pass

            # Project breakdown map
            proj_map.setdefault(proj, {"Completed": 0, "In Progress": 0,
                                       "Blocked": 0, "Yet to Start": 0})
            proj_map[proj][cat] += 1

        completion_rate  = round(completed_count / total_tasks * 100, 1) if total_tasks > 0 else 0.0
        on_time_rate     = round(on_time_completed / completed_count * 100, 1) if completed_count > 0 else 0.0
        avg_overdue_days = round(sum(overdue_days_list) / len(overdue_days_list), 1) if overdue_days_list else 0.0

        # ── Performance Metrics — Row 1: Workload Overview ──
        st.markdown("### 📊 Performance Metrics")
        r1c1, r1c2, r1c3, r1c4 = st.columns(4)
        r1c1.metric("Total Assigned Tasks", total_tasks)
        r1c2.metric("Completed Tasks", completed_count)
        r1c3.metric(
            "Completion Rate", f"{completion_rate}%",
            delta="On track" if completion_rate >= 80 else "Needs attention",
            delta_color="normal" if completion_rate >= 80 else "inverse"
        )
        r1c4.metric(
            "Backlogs (Overdue Tasks)", backlogs,
            delta=f"{backlogs} overdue" if backlogs > 0 else "All clear",
            delta_color="inverse" if backlogs > 0 else "normal"
        )

        st.markdown("")

        # ── Performance Metrics — Row 2: Quality & Engagement ──
        r2c1, r2c2, r2c3, r2c4 = st.columns(4)
        r2c1.metric("In Progress", in_progress_count)
        r2c2.metric(
            "Blocked / On Hold", blocked_count,
            delta="Action needed" if blocked_count > 0 else "None blocked",
            delta_color="inverse" if blocked_count > 0 else "off"
        )
        r2c3.metric(
            "On-Time Delivery Rate",
            f"{on_time_rate}%" if completed_count > 0 else "\u2014",
            delta="Good" if on_time_rate >= 80 else ("Low" if completed_count > 0 else None),
            delta_color="normal" if on_time_rate >= 80 else "inverse"
        )
        r2c4.metric(
            "Avg. Overdue Days",
            f"{avg_overdue_days} days" if overdue_days_list else "0 days",
            delta="Delay detected" if avg_overdue_days > 3 else "Healthy",
            delta_color="inverse" if avg_overdue_days > 3 else "normal"
        )

        # ── Visualisations ──
        if total_tasks > 0:
            viz_col1, viz_col2 = st.columns([2, 3])

            # Left: donut pie — Task Status Distribution
            with viz_col1:
                st.markdown("#### Task Status Distribution")
                df_chart = pd.DataFrame({
                    "Status": ["Completed", "In Progress", "Blocked", "Yet to Start"],
                    "Count":  [completed_count, in_progress_count, blocked_count, yet_to_start_count]
                })
                df_chart = df_chart[df_chart["Count"] > 0]
                fig_pie = px.pie(
                    df_chart, values="Count", names="Status", hole=0.45,
                    color="Status",
                    color_discrete_map={
                        "Completed": "#27ae60",
                        "In Progress": "#2980b9",
                        "Blocked": "#c0392b",
                        "Yet to Start": "#95a5a6"
                    }
                )
                fig_pie.update_layout(
                    margin=dict(t=10, b=0, l=0, r=0), height=280,
                    showlegend=True,
                    legend=dict(orientation="h", y=-0.2)
                )
                st.plotly_chart(fig_pie, use_container_width=True)

            # Right: horizontal stacked bar — Tasks by Project
            with viz_col2:
                st.markdown("#### Tasks by Project")
                proj_rows = []
                for proj, counts in proj_map.items():
                    for cat, cnt in counts.items():
                        if cnt > 0:
                            proj_rows.append({"Project": proj, "Status": cat, "Count": cnt})
                if proj_rows:
                    df_proj = pd.DataFrame(proj_rows)
                    fig_bar = px.bar(
                        df_proj, x="Count", y="Project",
                        color="Status", orientation="h", barmode="stack",
                        color_discrete_map={
                            "Completed": "#27ae60",
                            "In Progress": "#2980b9",
                            "Blocked": "#c0392b",
                            "Yet to Start": "#95a5a6"
                        }
                    )
                    fig_bar.update_layout(
                        margin=dict(t=10, b=0, l=0, r=10), height=280,
                        legend=dict(orientation="h", y=-0.3),
                        yaxis=dict(autorange="reversed")
                    )
                    st.plotly_chart(fig_bar, use_container_width=True)
                else:
                    st.info("No project breakdown available.")
        else:
            st.info("No tasks currently assigned to this employee.")

        st.divider()

        # ── AI Skills & Weaknesses Matrix ──
        st.markdown("### \U0001f9e0 Skills & Weaknesses Matrix")

        # Session-state keys scoped per employee — prevents bleed when switching
        ss_strengths_key  = f"temp_strengths_{selected_emp}"
        ss_weaknesses_key = f"temp_weaknesses_{selected_emp}"

        # Load saved values from DB
        skills_info, _ = api_get(f"/skills/{selected_emp}")
        strengths_val  = skills_info.get("strengths",  "") if skills_info else ""
        weaknesses_val = skills_info.get("weaknesses", "") if skills_info else ""

        # Prefer session-state (AI-generated or in-flight edits) over DB value
        strengths_val  = st.session_state.get(ss_strengths_key,  strengths_val)
        weaknesses_val = st.session_state.get(ss_weaknesses_key, weaknesses_val)

        # Auto-Generate button — must live OUTSIDE the form to write session_state
        col_ai_btn, col_ai_hint = st.columns([1, 3])
        with col_ai_btn:
            if st.button("\U0001fa84 Auto-Generate via AI", use_container_width=True):
                with st.spinner("Analysing task history with Gemini AI\u2026"):
                    gen_data, gen_err = api_get(f"/skills/generate/{selected_emp}")
                if gen_err:
                    st.error(f"AI generation failed: {gen_err}")
                elif gen_data:
                    st.session_state[ss_strengths_key]  = gen_data.get("strengths",  "")
                    st.session_state[ss_weaknesses_key] = gen_data.get("weaknesses", "")
                    st.success("\u2705 AI analysis complete \u2014 review and save below.")
                    st.rerun()
        with col_ai_hint:
            st.caption(
                "AI reads all assigned tasks (status, ETA, remarks) and suggests strengths & "
                "skill gaps. Review and edit the output before clicking Save."
            )

        # Skills matrix form
        with st.form("skills_matrix_form"):
            col_sk1, col_sk2 = st.columns(2)
            with col_sk1:
                strengths_input = st.text_area(
                    "Strengths (Skills they are good at)",
                    value=strengths_val, height=150,
                    help="List technical skills, modules, or soft skills they excel in."
                )
            with col_sk2:
                weaknesses_input = st.text_area(
                    "Weaknesses / Skill Gaps (Skills they are lagging at)",
                    value=weaknesses_val, height=150,
                    help="List areas where mentoring or training is required."
                )

            save_skills_clicked = st.form_submit_button("\U0001f4be Save Employee Evaluation")
            if save_skills_clicked:
                payload_skills = {
                    "employee_name": selected_emp,
                    "strengths":     strengths_input,
                    "weaknesses":    weaknesses_input
                }
                res_sk, err_sk = api_post_json("/skills", payload_skills)
                if err_sk:
                    st.error(f"Failed to save evaluation: {err_sk}")
                else:
                    # Clear temp state so DB value takes over on next load
                    st.session_state.pop(ss_strengths_key,  None)
                    st.session_state.pop(ss_weaknesses_key, None)
                    st.success(f"Evaluation for {selected_emp} saved successfully!")
                    st.rerun()


with tab_targets:
    st.subheader("🎯 Project Milestones & Weekly Targets")
    
    # Load list of projects from live cache to set targets
    projects_list = []
    SKIP_SHEETS_TGT = {"Projects"}
    if os.path.exists("sharepoint_cache.xlsx"):
        try:
            xl_file = pd.ExcelFile("sharepoint_cache.xlsx")
            projects_list = [s for s in xl_file.sheet_names if s not in SKIP_SHEETS_TGT]
        except Exception:
            pass
    if not projects_list:
        projects_list = ["Rovian Phase_1", "Fanam Care", "Agentic Commerce", "Fanam Guard"]
        
    selected_target_proj = st.selectbox("Select Project Name", sorted(projects_list))
    
    # Load targets list from database for this project
    targets_list, _ = api_get("/targets", project=selected_target_proj)
    
    # 1. Target Setter Form (PM sets target)
    st.markdown("### ➕ Set Weekly Target")
    with st.form("set_weekly_target_form"):
        col_t1, col_t2 = st.columns(2)
        with col_t1:
            week_start_input = st.date_input("Week Starting Date (Monday)", value=datetime.now().date())
        with col_t2:
            target_deadline = st.date_input("Target Milestone Deadline", value=datetime.now().date())
            
        target_milestone_input = st.text_area("Target Milestone / Deliverable Description", placeholder="e.g., Deliver fully functional Teacher Module and descriptive test screens")
        dependencies_input = st.text_area("Dependencies / Blockers (Optional)", placeholder="e.g., Awaiting final API contract design from design team")
        
        submit_target = st.form_submit_button("🎯 Set Target")
        if submit_target:
            payload_target = {
                "project": selected_target_proj,
                "week_start_date": str(week_start_input),
                "target_milestone": target_milestone_input,
                "deadline": str(target_deadline),
                "dependencies": dependencies_input,
                "achieved": False,
                "achievement_notes": "",
                "risks_faced": ""
            }
            res_target, err_target = api_post_json("/targets", payload_target)
            if err_target:
                st.error(f"Failed to set weekly target: {err_target}")
            else:
                st.success("Weekly target set successfully!")
                st.rerun()
                
    st.divider()
    
    # 2. Saturday Update / History Tracker
    st.markdown("### 📋 Weekly Milestone Status & Saturday Reviews")
    if not targets_list:
        st.info(f"No weekly targets defined for project '{selected_target_proj}' yet.")
    else:
        for tgt in targets_list:
            week_str = tgt.get("week_start_date")
            achieved = tgt.get("achieved", False)
            status_label = "🟢 Achieved" if achieved else "🔴 Pending"
            
            with st.expander(f"Week Starting {week_str} — {status_label}"):
                st.markdown(f"**Target Milestone:** {tgt.get('target_milestone')}")
                st.markdown(f"**Deadline:** {tgt.get('deadline')}")
                st.markdown(f"**Initial Dependencies:** {tgt.get('dependencies') or 'None'}")
                
                # Saturday Report Form to update status/risks/notes
                st.markdown("---")
                st.markdown("##### Saturday Status Update")
                with st.form(f"update_status_form_{tgt.get('id')}"):
                    achieved_update = st.checkbox("Mark as Achieved", value=achieved)
                    risks_update = st.text_area("Risks / Blocker Faced", value=tgt.get("risks_faced", ""))
                    notes_update = st.text_area("Achievement Notes / Mitigation Plan", value=tgt.get("achievement_notes", ""))
                    
                    update_tgt_btn = st.form_submit_button("💾 Save Status Update")
                    if update_tgt_btn:
                        payload_update = {
                            "project": selected_target_proj,
                            "week_start_date": week_str,
                            "target_milestone": tgt.get("target_milestone"),
                            "deadline": tgt.get("deadline"),
                            "dependencies": tgt.get("dependencies"),
                            "achieved": achieved_update,
                            "achievement_notes": notes_update,
                            "risks_faced": risks_update
                        }
                        res_up, err_up = api_post_json("/targets", payload_update)
                        if err_up:
                            st.error(f"Failed to update target: {err_up}")
                        else:
                            st.success("Weekly status updated successfully!")
                            st.rerun()

with tab_history:
    st.subheader("Teams reminder send history")
    history = history_data.get("history", []) if history_data else []
    if not history:
        st.info("No reminders sent yet.")
    else:
        hdf = pd.DataFrame(history)
        status_icons = {"sent": "✅", "failed": "❌", "skipped": "⏭️"}
        for _, row in hdf.iterrows():
            icon = status_icons.get(row.get("status"), "•")
            st.markdown(
                f"{icon} **{row.get('sent_at')}** — {row.get('assignee')} "
                f"({row.get('email') or 'no email'}) · {row.get('task_count')} task(s) · "
                f"**{row.get('status')}**"
            )
            if row.get("error_detail"):
                st.caption(f"Error: {row['error_detail']}")
        with st.expander("View as table"):
            st.dataframe(hdf, use_container_width=True, hide_index=True)

with tab_replies:
    col_a, col_b = st.columns(2)

    with col_a:
        st.subheader("⏳ Awaiting employee reply")
        pending_replies = awaiting_data.get("pending", []) if awaiting_data else []
        if not pending_replies:
            st.info("No chats waiting for a reply.")
        else:
            for p in pending_replies:
                task_count = len(p.get("tasks", []))
                st.markdown(
                    f"**{p.get('assignee')}** ({p.get('email')}) · sent {p.get('sent_at')} · "
                    f"{task_count} task(s)"
                )

    with col_b:
        st.subheader("✅ Replies saved to SharePoint")
        replied = replied_data.get("history", []) if replied_data else []
        if not replied:
            st.info("No replies captured yet.")
        else:
            for r in replied:
                sp_ok = "✅" if r.get("sharepoint_written") else "❌"
                st.markdown(
                    f"{sp_ok} **{r.get('assignee')}** · replied {r.get('replied_at')}"
                )
                st.caption(f"\"{r.get('reply_text', '')[:200]}\"")
            with st.expander("View as table"):
                st.dataframe(pd.DataFrame(replied), use_container_width=True, hide_index=True)

with tab_sprint_delays:
    st.subheader("⚠️ Sprint Missed Deadlines & Root Cause Drill-down (REQ-U07)")
    st.caption("Tracks tasks that missed their ETA, along with root causes provided by employees via Teams.")
    
    # 1. Fetch tasks
    res_tasks, err_tasks = api_get("/tasks")
    all_tasks = res_tasks.get("tasks", []) if res_tasks else []
    today_dt = datetime.now().date()
    
    overdue_tasks = []
    for t in all_tasks:
        if t.get("eta"):
            try:
                eta_dt = datetime.strptime(t["eta"], "%Y-%m-%d").date()
                status_lower = (t.get("status") or "").lower().strip()
                is_done = any(kw in status_lower for kw in ("complete", "done", "closed", "resolved", "100%", "90%"))
                if eta_dt < today_dt and not is_done:
                    delay_days = (today_dt - eta_dt).days
                    overdue_tasks.append({
                        "Project": t.get("project"),
                        "Task": t.get("task"),
                        "Assignee": t.get("assignee"),
                        "ETA": t.get("eta_str"),
                        "Delay (Days)": delay_days,
                        "Status": t.get("status"),
                        "Remarks": t.get("remarks")
                    })
            except Exception:
                pass

    # 2. Render KPIs
    c_od1, c_od2, c_od3 = st.columns(3)
    c_od1.metric("Total Missed Deadlines", len(overdue_tasks))
    avg_delay = round(sum(x["Delay (Days)"] for x in overdue_tasks) / len(overdue_tasks), 1) if overdue_tasks else 0.0
    c_od2.metric("Avg. Delay Duration", f"{avg_delay} days")
    
    # Calculate unique projects with delays
    unique_proj_delays = len(set(x["Project"] for x in overdue_tasks)) if overdue_tasks else 0
    c_od3.metric("Affected Projects", unique_proj_delays)
    
    # 3. Delay list table
    if overdue_tasks:
        st.write("### 📋 Overdue Tasks & Current Remarks")
        st.dataframe(pd.DataFrame(overdue_tasks), use_container_width=True, hide_index=True)
    else:
        st.info("No tasks have missed their deadlines! All current sprints are on track.")

    # 4. Fetch Teams Reply Root Causes
    st.write("### 💬 Employee Explanations & Root Causes (from Teams)")
    replied_history_res, _ = api_get("/replied-history", limit=100)
    if replied_history_res and replied_history_res.get("history"):
        explanation_rows = []
        for h in replied_history_res["history"]:
            if h.get("reply_text"):
                explanation_rows.append({
                    "Date": h.get("replied_at", "—")[:10] if h.get("replied_at") else "—",
                    "Employee": h.get("assignee"),
                    "Teams Explanation (Root Cause)": h.get("reply_text"),
                    "SharePoint Updated": "✅ Yes" if h.get("sharepoint_written") else "❌ No"
                })
        if explanation_rows:
            st.dataframe(pd.DataFrame(explanation_rows), use_container_width=True, hide_index=True)
        else:
            st.info("No delay explanations logged yet.")
    else:
        st.info("No replied history found.")

with tab_executive_summary:
    st.subheader("👔 High-Level Executive Management Summary (REQ-H07)")
    st.caption("High-level overview of project health and milestone updates, hiding individual task complexities.")
    
    # 1. Project stats roll-up
    res_tasks_exec, _ = api_get("/tasks")
    all_tasks_exec = res_tasks_exec.get("tasks", []) if res_tasks_exec else []
    
    from collections import defaultdict
    project_summary = defaultdict(lambda: {"total": 0, "completed": 0, "in_progress": 0, "blocked": 0, "overdue": 0})
    today_dt = datetime.now().date()
    
    for t in all_tasks_exec:
        proj = t.get("project") or "General"
        project_summary[proj]["total"] += 1
        
        status_lower = (t.get("status") or "").lower().strip()
        is_done = any(kw in status_lower for kw in ('complete', 'done', 'closed', 'resolved', '100%', '90%'))
        is_wip = any(kw in status_lower for kw in ('progress', 'wip', 'active', 'doing'))
        is_blocked = any(kw in status_lower for kw in ('block', 'hold'))
        
        if is_done:
            project_summary[proj]["completed"] += 1
        elif is_wip:
            project_summary[proj]["in_progress"] += 1
        elif is_blocked:
            project_summary[proj]["blocked"] += 1
            
        # Check if overdue
        if t.get("eta"):
            try:
                eta_dt = datetime.strptime(t["eta"], "%Y-%m-%d").date()
                if eta_dt < today_dt and not is_done:
                    project_summary[proj]["overdue"] += 1
            except Exception:
                pass
                
    # Format into DataFrame
    summary_rows = []
    for proj, stats in project_summary.items():
        comp_rate = round((stats["completed"] / stats["total"]) * 100) if stats["total"] > 0 else 100
        summary_rows.append({
            "Project Area": proj,
            "Total Tasks": stats["total"],
            "Completed": stats["completed"],
            "In Progress": stats["in_progress"],
            "Blocked": stats["blocked"],
            "Overdue": stats["overdue"],
            "Completion Rate": f"{comp_rate}%"
        })
        
    df_summary = pd.DataFrame(summary_rows)
    if not df_summary.empty:
        st.write("### 📈 Project Delivery Roll-up")
        st.dataframe(df_summary, use_container_width=True, hide_index=True)
        
        # Draw a beautiful summary chart
        fig = px.bar(
            df_summary, 
            x="Project Area", 
            y=["Completed", "In Progress", "Blocked", "Overdue"], 
            title="Workload Distribution by Project Area",
            color_discrete_map={
                "Completed": "#27ae60",
                "In Progress": "#2980b9",
                "Blocked": "#e67e22",
                "Overdue": "#c0392b"
            }
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No active projects found.")

with tab_logs:
    st.subheader("Recent activity")
    logs = logs_data.get("logs", []) if logs_data else []
    if logs:
        ldf = pd.DataFrame(logs)
        st.dataframe(ldf, use_container_width=True, hide_index=True)
    else:
        st.info("No logs yet.")


with tab_excel:
    st.subheader("📁 Live SharePoint Excel Cache Viewer")
    st.caption("This shows the local cache of the SharePoint spreadsheet. Sync to download the latest.")
    
    cache_path = "sharepoint_cache.xlsx"
    if os.path.exists(cache_path):
        try:
            xl_file = pd.ExcelFile(cache_path)
            sheets = xl_file.sheet_names
            selected_sheet = st.selectbox("Select sheet to view", sheets, index=0 if len(sheets) > 0 else None)
            if selected_sheet:
                df_sheet = xl_file.parse(selected_sheet)
                st.dataframe(clean_df_for_display(df_sheet), use_container_width=True)
        except Exception as e:
            st.error(f"Error loading Excel cache: {e}")
    else:
        st.warning("No cache file found. Click 'Test SharePoint sync' in the sidebar or run sync to fetch it.")
        
    if cfg and cfg.get("sharepoint_share_url"):
        st.markdown("---")
        st.link_button("🌐 Open Live SharePoint Excel in Browser", cfg["sharepoint_share_url"])


with tab_config:
    st.subheader("⚙️ System Configuration")
    if cfg:
        with st.form("edit_config_form"):
            st.markdown("**Daily Schedule Times (UTC - HH:MM)**")
            col_m, col_pm, col_e, col_dir = st.columns(4)
            with col_m:
                morning_input = st.text_input("Morning (10:00 AM IST)", value=cfg.get("morning_time_utc", "04:30"))
            with col_pm:
                pm_report_input = st.text_input("PM Report (10:20 AM IST)", value=cfg.get("pm_report_time_utc", "05:00"))
            with col_e:
                evening_input = st.text_input("Evening (5:00 PM IST)", value=cfg.get("evening_time_utc", "11:30"))
            with col_dir:
                directors_input = st.text_input("Directors EOD (5:30 PM IST)", value=cfg.get("directors_report_time_utc", "12:00"))
                
            st.markdown("**Test Mode Settings**")
            col_t1, col_t2, col_t3 = st.columns(3)
            with col_t1:
                test_teams_input = st.checkbox("Teams DMs Test Mode", value=cfg.get("test_mode_teams", False))
            with col_t2:
                test_pm_input = st.checkbox("PM Email Test Mode", value=cfg.get("test_mode_pm", False))
            with col_t3:
                test_directors_input = st.checkbox("Directors Email Test Mode", value=cfg.get("test_mode_directors", False))
                
            test_email_input = st.text_input("Test Destination Email (for redirected messages/emails)", value=cfg.get("test_teams_email", ""))
            
            pm_email_input = st.text_input("PM Email (Receives unassigned tasks report)", value=cfg.get("pm_email", ""))
            directors_email_input = st.text_input("Directors Email (Receives EOD report, separate multiple with commas)", value=cfg.get("directors_email", ""))
            
            col_p1, col_p2 = st.columns(2)
            with col_p1:
                poll_input = st.number_input("Poll replies interval (minutes)", min_value=1, max_value=60, value=int(cfg.get("reply_poll_minutes", 5)))
            with col_p2:
                check_new_input = st.number_input("Check new tasks interval (minutes)", min_value=1, max_value=60, value=int(cfg.get("new_task_check_minutes", 2)))
            
            save_clicked = st.form_submit_button("💾 Save Config & Reschedule")
            if save_clicked:
                payload = {
                    "test_mode_teams": test_teams_input,
                    "test_mode_pm": test_pm_input,
                    "test_mode_directors": test_directors_input,
                    "test_teams_email": test_email_input,
                    "morning_time_utc": morning_input,
                    "pm_report_time_utc": pm_report_input,
                    "evening_time_utc": evening_input,
                    "directors_report_time_utc": directors_input,
                    "reply_poll_minutes": poll_input,
                    "new_task_check_minutes": check_new_input,
                    "pm_email": pm_email_input,
                    "directors_email": directors_email_input
                }
                res, err = api_post_json("/config", payload)
                if err:
                    st.error(f"Failed to update config: {err}")
                else:
                    st.success("Configuration updated successfully! Scheduler reloaded.")
                    st.rerun()

    st.divider()
    st.subheader("🎉 Test HR Milestone Anniversary Notification Trigger")
    st.caption("This triggers a mock HR Milestone Anniversary check for testing. Mails will be routed to your test email.")
    
    # Load list of active employees for dropdown
    emps = load_employees()
    emp_names_list = [e["Employee Name"] for e in emps] if emps else ["Eswar E"]
    
    with st.form("test_milestones_form"):
        col_ts1, col_ts2 = st.columns(2)
        with col_ts1:
            test_emp_name = st.selectbox("Test Employee Name", sorted(emp_names_list))
        with col_ts2:
            test_years_num = st.number_input("Mock Years Completed", min_value=1, max_value=10, value=3)
            
        test_email_addr = st.text_input("Send Test Mails To (Official / Test email)", value=cfg.get("test_teams_email", "") if cfg else "")
        
        trigger_ms_btn = st.form_submit_button("🚀 Trigger Milestone Test Mail")
        if trigger_ms_btn:
            if not test_email_addr:
                st.error("Please provide a destination email address!")
            else:
                with st.spinner("Processing milestone alerts..."):
                    res_ms, err_ms = api_post("/sharepoint/test-milestone", employee_name=test_emp_name, mock_years=int(test_years_num), mock_email=test_email_addr)
                if err_ms:
                    st.error(f"Milestone trigger failed: {err_ms}")
                elif res_ms:
                    st.success(f"Milestone test triggered successfully! Processed {res_ms.get('processed')} milestone(s).")
                    if res_ms.get("details"):
                        st.json(res_ms.get("details"))


st.caption(f"Last refreshed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
