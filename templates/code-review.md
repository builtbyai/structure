---
title: "Code Review: {{title}}"
date: "{{date}}"
type: code-review
pr_number: ""
author: ""
reviewer: ""
status: pending
tags: [code-review, development]
---

<div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 40px 30px; border-radius: 16px; color: white; text-align: center; margin: 20px 0; box-shadow: 0 12px 40px rgba(139, 92, 246, 0.4);">
  <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 10px;">CODE REVIEW</div>
  <h1 style="margin: 0 0 15px 0; font-size: 2em; font-weight: 700;">{{title}}</h1>
  <div style="display: inline-flex; gap: 15px; flex-wrap: wrap; justify-content: center;">
    <span style="background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px;">PR #</span>
    <span style="background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px;">Pending Review</span>
  </div>
</div>

---

## Review Summary

<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 25px 0;">
  <div style="padding: 20px; border-radius: 12px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; text-align: center;">
    <div style="font-size: 2em; font-weight: bold;">0</div>
    <div style="font-size: 0.85em; opacity: 0.9;">Critical</div>
  </div>
  <div style="padding: 20px; border-radius: 12px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-align: center;">
    <div style="font-size: 2em; font-weight: bold;">0</div>
    <div style="font-size: 0.85em; opacity: 0.9;">Warnings</div>
  </div>
  <div style="padding: 20px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-align: center;">
    <div style="font-size: 2em; font-weight: bold;">0</div>
    <div style="font-size: 0.85em; opacity: 0.9;">Suggestions</div>
  </div>
  <div style="padding: 20px; border-radius: 12px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-align: center;">
    <div style="font-size: 2em; font-weight: bold;">0</div>
    <div style="font-size: 0.85em; opacity: 0.9;">Files Changed</div>
  </div>
</div>

---

## PR Details

<div style="background: white; padding: 25px; border-radius: 12px; border: 1px solid #e0e0e0; margin: 20px 0;">

| Field | Value |
|-------|-------|
| **Author** |  |
| **Reviewer** |  |
| **Branch** |  |
| **Target** | main |
| **Created** | {{date}} |

</div>

---

## Files Changed

<div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #8b5cf6; margin: 20px 0;">

| File | Changes | Status |
|------|:-------:|:------:|
|  | +0 / -0 | Review |
|  | +0 / -0 | Review |

</div>

---

## Critical Issues

> [!error] Must Fix Before Merge
> Issues that block approval

<div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #ef4444; margin: 15px 0;">

**File:** `path/to/file.ts`  
**Line:** 42  
**Issue:** 

</div>

---

## Warnings

> [!warning] Should Address
> Non-blocking but recommended fixes

<div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #f59e0b; margin: 15px 0;">

**File:** `path/to/file.ts`  
**Line:** 15  
**Issue:** 

</div>

---

## Suggestions

> [!tip] Nice to Have
> Optional improvements

<div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #3b82f6; margin: 15px 0;">

**File:** `path/to/file.ts`  
**Line:** 88  
**Suggestion:** 

</div>

---

## Checklist

### Code Quality
- [ ] Code follows project conventions
- [ ] No code duplication
- [ ] Functions are well-named and focused
- [ ] Comments explain "why" not "what"

### Security
- [ ] No hardcoded credentials
- [ ] Input validation present
- [ ] No SQL injection risks
- [ ] XSS prevention in place

### Testing
- [ ] Unit tests added/updated
- [ ] Tests cover edge cases
- [ ] All tests passing

### Documentation
- [ ] README updated if needed
- [ ] API docs updated if needed
- [ ] Inline comments adequate

---

## Review Decision

<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 25px 0;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; cursor: pointer;">
    <div style="font-size: 2em; margin-bottom: 5px;">Approve</div>
    <div style="font-size: 0.85em; opacity: 0.9;">Ready to merge</div>
  </div>
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; cursor: pointer;">
    <div style="font-size: 2em; margin-bottom: 5px;">Request Changes</div>
    <div style="font-size: 0.85em; opacity: 0.9;">Needs work</div>
  </div>
  <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; cursor: pointer;">
    <div style="font-size: 2em; margin-bottom: 5px;">Comment</div>
    <div style="font-size: 0.85em; opacity: 0.9;">No decision</div>
  </div>
</div>

---

## Additional Notes



---

<div style="text-align: center; color: #888; font-size: 0.85em; padding: 20px; border-top: 2px solid #8b5cf6; margin-top: 30px;">
  Code Review | {{title}} | {{date}}
</div>
