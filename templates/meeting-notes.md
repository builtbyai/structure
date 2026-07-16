---
title: "{{title}}"
date: "{{date}}"
type: meeting
attendees: []
tags: [meeting, notes]
---

<div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 30px; border-radius: 16px; color: white; text-align: center; margin: 20px 0; box-shadow: 0 12px 40px rgba(59, 130, 246, 0.4);">
  <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 10px;">MEETING NOTES</div>
  <h1 style="margin: 0 0 15px 0; font-size: 2em; font-weight: 700;">{{title}}</h1>
  <p style="font-size: 1em; margin: 0; opacity: 0.9;">{{date}} | Duration: ____ mins</p>
</div>

---

## Meeting Info

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 25px 0;">
  <div style="background: white; padding: 18px; border-radius: 10px; border-left: 4px solid #3b82f6; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <div style="color: #6b7280; font-size: 0.85em; margin-bottom: 5px;">Date & Time</div>
    <div style="color: #1f2937; font-weight: 600;">{{date}}</div>
  </div>
  <div style="background: white; padding: 18px; border-radius: 10px; border-left: 4px solid #10b981; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <div style="color: #6b7280; font-size: 0.85em; margin-bottom: 5px;">Location</div>
    <div style="color: #1f2937; font-weight: 600;">Virtual / In-person</div>
  </div>
  <div style="background: white; padding: 18px; border-radius: 10px; border-left: 4px solid #f59e0b; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <div style="color: #6b7280; font-size: 0.85em; margin-bottom: 5px;">Organizer</div>
    <div style="color: #1f2937; font-weight: 600;"></div>
  </div>
  <div style="background: white; padding: 18px; border-radius: 10px; border-left: 4px solid #8b5cf6; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <div style="color: #6b7280; font-size: 0.85em; margin-bottom: 5px;">Meeting Type</div>
    <div style="color: #1f2937; font-weight: 600;">Status / Planning / Review</div>
  </div>
</div>

---

## Attendees

<div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0;">
  <span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 8px 16px; border-radius: 20px; font-weight: 500;">Present</span>
  <span style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 8px 16px; border-radius: 20px; font-weight: 500;">Absent</span>
  <span style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 8px 16px; border-radius: 20px; font-weight: 500;">Optional</span>
</div>

| Name | Role | Status |
|------|------|:------:|
|  |  | Present |
|  |  | Present |

---

## Agenda

<div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%); padding: 25px; border-radius: 12px; border-left: 4px solid #3b82f6; margin: 20px 0;">

1. [ ] Topic 1 - 10 mins
2. [ ] Topic 2 - 15 mins
3. [ ] Topic 3 - 10 mins
4. [ ] Open Discussion - 10 mins

</div>

---

## Discussion Notes

### Topic 1


### Topic 2


### Topic 3


---

## Action Items

<div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); margin: 20px 0;">

| Action | Owner | Due Date | Status |
|--------|-------|----------|:------:|
|  |  |  | Pending |
|  |  |  | Pending |
|  |  |  | Pending |

</div>

---

## Decisions Made

> [!success] Key Decisions
> - Decision 1:
> - Decision 2:

---

## Follow-up

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 25px 0;">
  <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%); padding: 20px; border-radius: 12px; border: 2px solid #10b981;">
    <div style="font-weight: 700; color: #059669; margin-bottom: 10px;">Next Steps</div>
    <ul style="margin: 0; padding-left: 20px; color: #1f2937;">
      <li></li>
      <li></li>
    </ul>
  </div>
  <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%); padding: 20px; border-radius: 12px; border: 2px solid #f59e0b;">
    <div style="font-weight: 700; color: #d97706; margin-bottom: 10px;">Next Meeting</div>
    <div style="color: #1f2937;">Date: <br>Topic: </div>
  </div>
</div>

---

<div style="text-align: center; color: #888; font-size: 0.85em; padding: 20px; border-top: 2px solid #3b82f6; margin-top: 30px;">
  Meeting Notes | {{title}} | {{date}}
</div>
