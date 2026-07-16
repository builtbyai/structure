---
title: "{{title}}"
date: "{{date}}"
type: project
status: active
tags: [project, dashboard]
---

<div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 50px 40px; border-radius: 20px; color: white; text-align: center; margin: 20px 0; box-shadow: 0 16px 50px rgba(245, 158, 11, 0.4);">
  <h1 style="margin: 0 0 15px 0; font-size: 2.5em; font-weight: 800; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">{{title}}</h1>
  <p style="font-size: 1.2em; margin: 0 0 25px 0; opacity: 0.95;">Project Dashboard & Status Overview</p>
  <div style="display: inline-flex; gap: 20px; flex-wrap: wrap; justify-content: center;">
    <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); padding: 12px 25px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.3);">
      <div style="font-size: 1.5em; font-weight: 700;">Active</div>
      <div style="font-size: 0.85em; opacity: 0.9;">Status</div>
    </div>
    <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); padding: 12px 25px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.3);">
      <div style="font-size: 1.5em; font-weight: 700;">Q1</div>
      <div style="font-size: 0.85em; opacity: 0.9;">Timeline</div>
    </div>
    <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); padding: 12px 25px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.3);">
      <div style="font-size: 1.5em; font-weight: 700;">High</div>
      <div style="font-size: 0.85em; opacity: 0.9;">Priority</div>
    </div>
  </div>
</div>

---

## Quick Stats

<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 25px 0;">
  <div style="padding: 25px 15px; border-radius: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; box-shadow: 0 6px 20px rgba(102, 126, 234, 0.3);">
    <div style="font-size: 2.5em; font-weight: bold; margin-bottom: 5px;">0%</div>
    <div style="font-size: 0.9em; opacity: 0.9;">Complete</div>
  </div>
  <div style="padding: 25px 15px; border-radius: 12px; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; text-align: center; box-shadow: 0 6px 20px rgba(17, 153, 142, 0.3);">
    <div style="font-size: 2.5em; font-weight: bold; margin-bottom: 5px;">0</div>
    <div style="font-size: 0.9em; opacity: 0.9;">Tasks Done</div>
  </div>
  <div style="padding: 25px 15px; border-radius: 12px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; text-align: center; box-shadow: 0 6px 20px rgba(240, 147, 251, 0.3);">
    <div style="font-size: 2.5em; font-weight: bold; margin-bottom: 5px;">0</div>
    <div style="font-size: 0.9em; opacity: 0.9;">In Progress</div>
  </div>
  <div style="padding: 25px 15px; border-radius: 12px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; text-align: center; box-shadow: 0 6px 20px rgba(79, 172, 254, 0.3);">
    <div style="font-size: 2.5em; font-weight: bold; margin-bottom: 5px;">0</div>
    <div style="font-size: 0.9em; opacity: 0.9;">Days Left</div>
  </div>
</div>

---

## Project Timeline

```mermaid
gantt
    dateFormat  YYYY-MM-DD
    title Project Schedule
    section Phase 1
    Planning         :done,    p1, 2026-01-01, 7d
    Requirements     :active,  p2, after p1, 7d
    section Phase 2
    Development      :         p3, after p2, 21d
    Testing          :         p4, after p3, 7d
    section Phase 3
    Deployment       :         p5, after p4, 3d
    Documentation    :         p6, after p5, 5d
```

---

## Progress Overview

<div style="margin: 25px 0;">
  <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
    <span style="font-weight: 600;">Overall Progress</span>
    <span style="color: #667eea; font-weight: 700;">0%</span>
  </div>
  <div style="width: 100%; height: 14px; background: #e5e7eb; border-radius: 7px; overflow: hidden;">
    <div style="width: 0%; height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); border-radius: 7px;"></div>
  </div>
</div>

### Phase Progress

| Phase | Status | Progress | Due Date |
|-------|:------:|:--------:|----------|
| Planning | Done | 100% | - |
| Requirements | In Progress | 50% | - |
| Development | Not Started | 0% | - |
| Testing | Not Started | 0% | - |
| Deployment | Not Started | 0% | - |

---

## Tasks

> [!warning] Blockers
> List any blockers here

### High Priority
- [ ] 

### Normal Priority
- [ ] 

### Low Priority
- [ ] 

---

## Team & Stakeholders

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 25px 0;">
  <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #3b82f6;">
    <div style="font-weight: 700; color: #2563eb; margin-bottom: 8px;">Project Lead</div>
    <div style="color: #1f2937;"></div>
  </div>
  <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #10b981;">
    <div style="font-weight: 700; color: #059669; margin-bottom: 8px;">Developer</div>
    <div style="color: #1f2937;"></div>
  </div>
  <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #8b5cf6;">
    <div style="font-weight: 700; color: #7c3aed; margin-bottom: 8px;">Stakeholder</div>
    <div style="color: #1f2937;"></div>
  </div>
</div>

---

## Notes & Decisions

<div style="background: white; padding: 25px; border-radius: 12px; border: 1px solid #e0e0e0; margin: 20px 0;">

### Key Decisions


### Meeting Notes


### Links & Resources
- 

</div>

---

<div style="text-align: center; color: #888; font-size: 0.85em; padding: 20px; border-top: 2px solid #f59e0b; margin-top: 30px;">
  <strong>{{title}}</strong> | Project Dashboard | Created: {{date}}
</div>
