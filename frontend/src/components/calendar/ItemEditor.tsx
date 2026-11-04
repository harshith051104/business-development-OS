import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react'
import { taskService } from '../../services/tasks'
import { meetingsService } from '../../services/meetings'
import { organizationsService } from '../../services/organizations'
import { extractLocalDateAndTime, formatLocalDateTimeToUtcIso } from '../../utils/date'
import type { BDTask, TaskComment, TaskPriority, TaskStatus } from '../../types/task'
import type { Meeting, MeetingType } from '../../types/meeting'
import type { Organization } from '../../types/organization'
import { avatarColor, initials, pad } from './calendarModel'

export interface Member {
  id: number
  name: string
}

export type EditorTarget =
  | { mode: 'task'; task: BDTask }
  | { mode: 'meeting'; meeting: Meeting }
  | { mode: 'create'; day: string; minutes: number | null; kind: 'task' | 'meeting' }

interface Props {
  target: EditorTarget
  anchor: DOMRect | null
  members: Member[]
  currentUserId?: number
  onClose: () => void
  onTaskSaved: (t: BDTask, message: string) => void
  onTaskDeleted: (id: number) => void
  onMeetingSaved: (m: Meeting, message: string) => void
  onMeetingDeleted: (id: number) => void
}

const STATUSES: TaskStatus[] = ['Todo', 'In Progress', 'Completed', 'Cancelled']
const PRIORITIES: TaskPriority[] = ['High', 'Medium', 'Low']
const MEETING_TYPES: MeetingType[] = ['Introduction', 'Project Showcase', 'Business Discussion', 'Partnership Discussion', 'Technical Discussion', 'Follow-up', 'Other']
const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240]

const field = 'w-full px-2.5 py-1.5 rounded-lg border border-[#2a1e4d] bg-[#0E0B1D] text-[#C9C2E3] text-xs [color-scheme:dark] focus:outline-none focus:border-[#8B7CC7]'
const label = 'block text-[11px] font-medium text-[#8B7CC7] mb-1'
const errText = (err: any, fallback: string) => err?.detail || err?.message || fallback

/** Details and editing for a calendar task or meeting, or the "Add" form. Floats next to the clicked item. */
export const ItemEditor: React.FC<Props> = ({ target, anchor, members, currentUserId, onClose, onTaskSaved, onTaskDeleted, onMeetingSaved, onMeetingDeleted }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: 0 })
  const [kind, setKind] = useState<'task' | 'meeting'>(target.mode === 'create' ? target.kind : target.mode)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Task fields
  const t = target.mode === 'task' ? target.task : null
  const [title, setTitle] = useState(t?.title ?? (target.mode === 'meeting' ? target.meeting.title : ''))
  const [description, setDescription] = useState(t?.description ?? (target.mode === 'meeting' ? target.meeting.description ?? '' : ''))
  const [status, setStatus] = useState<TaskStatus>(t?.status ?? 'Todo')
  const [priority, setPriority] = useState<TaskPriority>(t?.priority ?? 'Medium')
  const [due, setDue] = useState(t?.due_date ? String(t.due_date).slice(0, 10) : target.mode === 'create' ? target.day : '')
  const [owner, setOwner] = useState<number | ''>(t?.owner_id ?? currentUserId ?? '')
  const [comments, setComments] = useState<TaskComment[] | null>(null)
  const [newComment, setNewComment] = useState('')

  // Meeting fields
  const m = target.mode === 'meeting' ? target.meeting : null
  const initialWhen = m
    ? extractLocalDateAndTime(m.scheduled_at)
    : { date: target.mode === 'create' ? target.day : '', time: target.mode === 'create' && target.minutes != null ? `${pad(Math.floor(target.minutes / 60))}:${pad(target.minutes % 60)}` : '09:00' }
  const [mDate, setMDate] = useState(initialWhen.date)
  const [mTime, setMTime] = useState(initialWhen.time)
  const [duration, setDuration] = useState(m?.duration_minutes ?? 45)
  const [mType, setMType] = useState<MeetingType>(m?.meeting_type ?? 'Business Discussion')
  const [location, setLocation] = useState(m?.location ?? '')
  const [url, setUrl] = useState(m?.meeting_url ?? '')
  const [detail, setDetail] = useState<Meeting | null>(null)
  const [orgQuery, setOrgQuery] = useState('')
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [orgId, setOrgId] = useState<number | ''>('')

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (!anchor) {
      setPos({ left: (vw - w) / 2, top: Math.max(16, (vh - h) / 2) })
      return
    }
    let left = anchor.right + 10
    if (left + w > vw - 12) left = anchor.left - w - 10
    if (left < 12) left = Math.max(12, (vw - w) / 2)
    const top = Math.min(Math.max(12, anchor.top - 20), vh - h - 12)
    setPos({ left, top })
  }, [anchor, kind, detail, comments, confirmDelete, error])

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (t) taskService.listComments(t.id).then(setComments).catch(() => setComments([]))
    if (m) meetingsService.getMeeting(m.id).then(setDetail).catch(() => setDetail(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (target.mode !== 'create' || kind !== 'meeting') return
    const h = setTimeout(() => {
      organizationsService
        .getOrganizations({ search: orgQuery.trim() || undefined, page_size: 20, sort_by: 'name', sort_order: 'asc' })
        .then((r) => setOrgs(r.items))
        .catch(() => setOrgs([]))
    }, 250)
    return () => clearTimeout(h)
  }, [orgQuery, kind, target.mode])

  const run = async (fn: () => Promise<void>) => {
    setSaving(true)
    setError(null)
    try {
      await fn()
    } catch (err: any) {
      setError(errText(err, 'The change was not saved.'))
    } finally {
      setSaving(false)
    }
  }

  const saveTask = () =>
    run(async () => {
      if (!title.trim()) throw new Error('Give the task a title.')
      if (t && t.due_date && !due) throw new Error('Removing a due date isn’t supported by the tasks API yet. Pick a new date instead.')
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        due_date: due || null,
        owner_id: owner === '' ? undefined : Number(owner),
      }
      if (t) {
        const saved = await taskService.update(t.id, body)
        onTaskSaved(saved, 'Task saved.')
      } else {
        const saved = await taskService.create({ ...body, due_date: due || null })
        onTaskSaved(saved, due ? 'Task added.' : 'Task added to Unscheduled tasks.')
      }
    })

  const quickComplete = () =>
    run(async () => {
      if (!t) return
      const saved = await taskService.update(t.id, { status: status === 'Completed' ? 'Todo' : 'Completed' })
      setStatus(saved.status)
      onTaskSaved(saved, saved.status === 'Completed' ? 'Task marked complete.' : 'Task reopened.')
    })

  const saveMeeting = () =>
    run(async () => {
      if (!title.trim()) throw new Error('Give the meeting a title.')
      const scheduled = formatLocalDateTimeToUtcIso(mDate, mTime)
      if (!scheduled) throw new Error('Pick a date and start time.')
      if (m) {
        let saved = await meetingsService.updateMeeting(m.id, {
          title: title.trim(),
          meeting_type: mType,
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          meeting_url: url.trim() || undefined,
        })
        const before = extractLocalDateAndTime(m.scheduled_at)
        if (before.date !== mDate || before.time !== mTime || m.duration_minutes !== duration) {
          // Reschedule keeps the meeting's history (old and new time).
          saved = await meetingsService.rescheduleMeeting(m.id, { scheduled_at: scheduled, duration_minutes: duration })
        }
        onMeetingSaved(saved, 'Meeting saved.')
      } else {
        if (!orgId) throw new Error('Choose the organization this meeting is with.')
        const saved = await meetingsService.createMeeting({
          organization_id: Number(orgId),
          title: title.trim(),
          meeting_type: mType,
          scheduled_at: scheduled,
          duration_minutes: duration,
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          meeting_url: url.trim() || undefined,
        })
        onMeetingSaved(saved, 'Meeting added. No invitations were sent.')
      }
    })

  const doDelete = () =>
    run(async () => {
      if (t) {
        await taskService.delete(t.id)
        onTaskDeleted(t.id)
      } else if (m) {
        await meetingsService.deleteMeeting(m.id)
        onMeetingDeleted(m.id)
      }
    })

  const addComment = () =>
    run(async () => {
      if (!t || !newComment.trim()) return
      const c = await taskService.addComment(t.id, newComment.trim())
      setComments((prev) => [...(prev || []), c])
      setNewComment('')
    })

  const isCreate = target.mode === 'create'
  const heading = isCreate ? `Add ${kind}` : kind === 'task' ? 'Task' : 'Meeting'

  return (
    <div className="fixed inset-0 z-[60]" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute w-[340px] max-h-[86vh] overflow-y-auto bg-[#0E0B1D] rounded-3xl shadow-2xl border border-[#2a1e4d] p-4 text-[#C9C2E3]"
        style={{ left: pos.left, top: pos.top }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <input
            aria-label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'task' ? 'Task title' : 'Meeting title'}
            className="flex-1 text-base font-semibold text-[#C9C2E3] bg-transparent border-b border-transparent focus:border-[#8B7CC7] placeholder:text-[#5A3B8C] focus:outline-none"
          />
          <button onClick={onClose} aria-label="Close" className="text-[#8B7CC7] hover:text-[#C9C2E3]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1.5 mb-3" role={isCreate ? 'tablist' : undefined}>
          {(['task', 'meeting'] as const).map((k) =>
            isCreate || k === kind ? (
              <button
                key={k}
                type="button"
                role={isCreate ? 'tab' : undefined}
                aria-selected={kind === k}
                disabled={!isCreate}
                onClick={() => setKind(k)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${kind === k ? (k === 'task' ? 'bg-[#3a3a52] text-[#C9C2E3]' : 'bg-[#3a3a52] text-[#C9C2E3]') : 'bg-[#2a1e4d] text-[#8B7CC7]'}`}
              >
                {k === 'task' ? 'Task' : 'Meeting / event'}
              </button>
            ) : null,
          )}
          {m && <span className="px-2.5 py-1 rounded-full text-[11px] bg-[#2a1e4d] text-[#8B7CC7]">{m.status}</span>}
        </div>

        {kind === 'task' ? (
          <div className="space-y-2.5">
            {t && (
              <button
                type="button"
                onClick={quickComplete}
                disabled={saving}
                className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold ${status === 'Completed' ? 'bg-[#2a1e4d] text-[#8B7CC7]' : 'bg-[#3a3a52] text-[#C9C2E3] hover:bg-[#3a3a52]'}`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> {status === 'Completed' ? 'Reopen task' : 'Mark complete'}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label} htmlFor="cal-status">Status</label>
                <select id="cal-status" className={field} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="cal-priority">Priority</label>
                <select id="cal-priority" className={field} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                  {PRIORITIES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={label} htmlFor="cal-due">Due date (no time — tasks don’t have a duration)</label>
              <input id="cal-due" type="date" className={field} value={due} onChange={(e) => setDue(e.target.value)} />
              {!t && !due && <p className="text-[11px] text-[#8B7CC7] mt-1">Leave empty to add it to Unscheduled tasks.</p>}
            </div>
            <div>
              <label className={label} htmlFor="cal-owner">Assigned to</label>
              <select id="cal-owner" className={field} value={owner} onChange={(e) => setOwner(e.target.value ? Number(e.target.value) : '')}>
                {members.map((mem) => (
                  <option key={mem.id} value={mem.id}>
                    {mem.name}
                    {mem.id === currentUserId ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="cal-desc">Description</label>
              <textarea id="cal-desc" rows={3} className={field} value={description || ''} onChange={(e) => setDescription(e.target.value)} />
            </div>
            {t?.entity_name && (
              <p className="text-[11px] text-[#8B7CC7]">
                Linked to {t.entity_type}: <span className="text-white">{t.entity_name}</span>
              </p>
            )}
            {t && (
              <div className="border-t border-[#2a1e4d] pt-2">
                <div className={label}>Comments</div>
                {comments === null ? (
                  <p className="text-[11px] text-[#8B7CC7]">Loading…</p>
                ) : comments.length === 0 ? (
                  <p className="text-[11px] text-[#8B7CC7]">No comments yet.</p>
                ) : (
                  <ul className="space-y-1.5 mb-2 max-h-32 overflow-y-auto">
                    {comments.map((c) => (
                      <li key={c.id} className="text-[11px]">
                        <span className="font-semibold text-[#C9C2E3]">{c.user_name || 'Someone'}</span>{' '}
                        <span className="text-[#8B7CC7]">{new Date(c.created_at).toLocaleDateString()}</span>
                        <div className="text-[#C9C2E3]">{c.body}</div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-1.5">
                  <input aria-label="New comment" className={field} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment" />
                  <button type="button" onClick={addComment} disabled={saving || !newComment.trim()} className="px-2.5 rounded-lg bg-[#5A3B8C] text-white text-xs disabled:opacity-40">
                    Post
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {isCreate ? (
              <div>
                <label className={label} htmlFor="cal-org">Organization</label>
                <input id="cal-org" className={field} value={orgQuery} onChange={(e) => setOrgQuery(e.target.value)} placeholder="Search your organizations" />
                <select aria-label="Choose organization" className={`${field} mt-1`} value={orgId} onChange={(e) => setOrgId(e.target.value ? Number(e.target.value) : '')} size={Math.min(5, Math.max(2, orgs.length))}>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              m && (
                <p className="text-xs text-[#8B7CC7]">
                  With{' '}
                  <Link to={`/business-development/organizations/${m.organization_id}`} className="text-[#8B7CC7] hover:underline">
                    {m.organization_name || 'organization'}
                  </Link>
                </p>
              )
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label} htmlFor="cal-mdate">Date</label>
                <input id="cal-mdate" type="date" className={field} value={mDate} onChange={(e) => setMDate(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="cal-mtime">Start</label>
                <input id="cal-mtime" type="time" step={900} className={field} value={mTime} onChange={(e) => setMTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label} htmlFor="cal-dur">Duration</label>
                <select id="cal-dur" className={field} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                  {[...new Set([...DURATIONS, duration])].sort((a, b) => a - b).map((d) => (
                    <option key={d} value={d}>
                      {d < 60 ? `${d} min` : `${d / 60} h`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="cal-mtype">Type</label>
                <select id="cal-mtype" className={field} value={mType} onChange={(e) => setMType(e.target.value as MeetingType)}>
                  {MEETING_TYPES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={label} htmlFor="cal-loc">Location</label>
              <input id="cal-loc" className={field} value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="cal-url">Video link</label>
              <input id="cal-url" className={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
            </div>
            <div>
              <label className={label} htmlFor="cal-mdesc">Description</label>
              <textarea id="cal-mdesc" rows={2} className={field} value={description || ''} onChange={(e) => setDescription(e.target.value)} />
            </div>
            {m && (
              <div>
                <div className={label}>Attendees</div>
                {!detail ? (
                  <p className="text-[11px] text-[#8B7CC7]">Loading…</p>
                ) : !detail.attendees?.length ? (
                  <p className="text-[11px] text-[#8B7CC7]">No contacts recorded.</p>
                ) : (
                  <ul className="space-y-1">
                    {detail.attendees.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-xs">
                        <span className="w-6 h-6 rounded-full text-[10px] font-semibold text-[#0E0B1D] flex items-center justify-center" style={{ backgroundColor: avatarColor(a.id) }}>
                          {initials(a.full_name)}
                        </span>
                        <span className="text-white">{a.full_name}</span>
                        {a.designation && <span className="text-[#8B7CC7] truncate">{a.designation}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-[#8B7CC7] mt-1">
                  Organizer assignment isn’t available: the meetings API doesn’t return or accept an owner.
                </p>
                <Link to={`/business-development/meetings/${m.id}`} className="inline-flex items-center gap-1 text-[11px] text-[#8B7CC7] hover:underline mt-1">
                  Open meeting page (notes, complete, cancel) <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-xs text-rose-200 bg-rose-500/15 rounded-lg px-2.5 py-1.5">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 mt-4">
          {!isCreate ? (
            confirmDelete ? (
              <span className="flex items-center gap-1.5 text-xs">
                Delete?
                <button onClick={doDelete} disabled={saving} className="px-2 py-1 rounded-md bg-rose-600 text-white">
                  Yes, delete
                </button>
                <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded-md bg-[#2a1e4d] text-[#8B7CC7]">
                  No
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-rose-300 hover:underline">
                Delete
              </button>
            )
          ) : (
            <span />
          )}
          <button
            onClick={kind === 'task' ? saveTask : saveMeeting}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#5A3B8C] hover:bg-[#5A3B8C] text-white text-xs font-semibold disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isCreate ? 'Add' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ItemEditor
