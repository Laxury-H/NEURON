"use client";

import React, { useState, useEffect } from "react";
import { Person, RelationshipType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  User,
  Mail,
  Phone,
  GraduationCap,
  Sparkles,
  Link as LinkIcon,
  BookOpen,
  Trash2,
  Unlink,
  Check,
  Edit2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

interface PersonDetailPanelProps {
  person: Person | null;
  courseId: string;
  onClose: () => void;
  onUpdatePerson: (personId: string, data: any) => Promise<void>;
  onUpdateRelationship: (
    personId: string,
    relType: RelationshipType,
    topics: string[],
    contextNote: string
  ) => Promise<void>;
  onUnlinkFromCourse: (personId: string) => Promise<void>;
  onDeletePerson: (personId: string) => Promise<void>;
}

export function PersonDetailPanel({
  person,
  courseId,
  onClose,
  onUpdatePerson,
  onUpdateRelationship,
  onUnlinkFromCourse,
  onDeletePerson,
}: PersonDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [classNameVal, setClassNameVal] = useState("");
  const [major, setMajor] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [notes, setNotes] = useState("");

  // Course relation specific fields
  const [relType, setRelType] = useState<RelationshipType>("Classmate");
  const [topicsInput, setTopicsInput] = useState("");
  const [contextNote, setContextNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (person) {
      setFullName(person.full_name);
      setNickname(person.nickname || "");
      setEmail(person.email || "");
      setPhone(person.phone || "");
      setClassNameVal(person.class_name || "");
      setMajor(person.major || "");
      setSkillsInput(person.skills.join(", "));
      setNotes(person.notes || "");

      const rel = person.course_relationship;
      if (rel) {
        setRelType(rel.relationship_type);
        setTopicsInput(rel.knowledge_topics.join(", "));
        setContextNote(rel.context_note || "");
      }
      setIsEditing(false);
    }
  }, [person]);

  if (!person) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const skillsArray = skillsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const topicsArray = topicsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await onUpdatePerson(person.id, {
        full_name: fullName.trim(),
        nickname: nickname.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        class_name: classNameVal.trim() || null,
        major: major.trim() || null,
        skills: skillsArray,
        notes: notes.trim() || null,
      });

      await onUpdateRelationship(person.id, relType, topicsArray, contextNote.trim());
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const initials = person.full_name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="absolute top-0 right-0 bottom-0 w-80 md:w-96 border-l border-border bg-background shadow-xl z-30 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4 bg-muted/40">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-xs font-bold">
            {initials}
          </div>
          <div className="truncate">
            <h3 className="font-semibold text-sm truncate">{person.full_name}</h3>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {person.course_relationship?.relationship_type || "Contact"}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setIsEditing(!isEditing)}
            title={isEditing ? "Cancel editing" : "Edit profile"}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onClose}
            title="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {isEditing ? (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Nickname</Label>
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Class</Label>
                <Input
                  value={classNameVal}
                  onChange={(e) => setClassNameVal(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Major / Department</Label>
              <Input
                value={major}
                onChange={(e) => setMajor(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Skills (comma separated)</Label>
              <Input
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                placeholder="MATLAB, Python, Power World"
              />
            </div>

            <div className="pt-2 border-t border-border space-y-3">
              <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                Course Context
              </span>

              <div className="space-y-1">
                <Label>Relationship Type</Label>
                <Select
                  value={relType}
                  onValueChange={(val) => setRelType(val as RelationshipType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Classmate">Classmate</SelectItem>
                    <SelectItem value="Project teammate">Project teammate</SelectItem>
                    <SelectItem value="Lecturer">Lecturer</SelectItem>
                    <SelectItem value="Friend">Friend</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Knowledge Topics (comma separated)</Label>
                <Input
                  value={topicsInput}
                  onChange={(e) => setTopicsInput(e.target.value)}
                  placeholder="Transmission Lines, Newton-Raphson"
                />
              </div>

              <div className="space-y-1">
                <Label>Course Context Note</Label>
                <Textarea
                  rows={2}
                  value={contextNote}
                  onChange={(e) => setContextNote(e.target.value)}
                  placeholder="Notes about collaboration in this course..."
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>General Notes</Label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Personal notes..."
              />
            </div>

            <Button
              className="w-full mt-2"
              size="sm"
              onClick={handleSave}
              disabled={saving || !fullName.trim()}
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Relationship Card */}
            <div className="p-3 rounded-md border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Role in Course
                </span>
                <Badge variant="default" className="text-[10px] font-mono">
                  {person.course_relationship?.relationship_type || "Connected"}
                </Badge>
              </div>

              {person.course_relationship?.context_note && (
                <p className="text-xs text-foreground italic bg-muted/30 p-2 rounded">
                  &ldquo;{person.course_relationship.context_note}&rdquo;
                </p>
              )}

              {person.course_relationship?.knowledge_topics &&
                person.course_relationship.knowledge_topics.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[10px] font-mono text-muted-foreground block mb-1">
                      KNOWLEDGE TOPICS
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {person.course_relationship.knowledge_topics.map((top, idx) => (
                        <Badge key={idx} variant="subtle" className="text-[10px]">
                          {top}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Contact Details */}
            <div className="space-y-2.5">
              <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                Contact & Academic Info
              </span>

              <div className="space-y-1.5 text-xs">
                {person.nickname && (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span>Known as: {person.nickname}</span>
                  </div>
                )}

                {person.email && (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <a
                      href={`mailto:${person.email}`}
                      className="hover:text-foreground underline underline-offset-2 truncate"
                    >
                      {person.email}
                    </a>
                  </div>
                )}

                {person.phone && (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{person.phone}</span>
                  </div>
                )}

                {(person.class_name || person.major) && (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {[person.class_name, person.major].filter(Boolean).join(" • ")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Skills */}
            {person.skills && person.skills.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground flex items-center space-x-1">
                  <Sparkles className="h-3 w-3" />
                  <span>Skills & Competencies</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {person.skills.map((skill, idx) => (
                    <Badge key={idx} variant="outline" className="text-[10px]">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Personal Notes */}
            {person.notes && (
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                  Personal Notes
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {person.notes}
                </p>
              </div>
            )}

            {/* Associated Courses */}
            {person.associated_courses && person.associated_courses.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-border">
                <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground flex items-center space-x-1">
                  <BookOpen className="h-3 w-3" />
                  <span>Associated Courses ({person.associated_courses.length})</span>
                </span>
                <div className="space-y-1">
                  {person.associated_courses.map((ac) => (
                    <div
                      key={ac.id}
                      className="p-1.5 rounded border border-border bg-card flex items-center justify-between text-[11px]"
                    >
                      <span className="font-mono font-bold">{ac.course_code}</span>
                      <span className="text-muted-foreground truncate mx-2">
                        {ac.course_name}
                      </span>
                      <Badge variant="subtle" className="text-[9px] shrink-0 font-mono">
                        {ac.relationship_type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-border p-3 bg-muted/20 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground h-8"
          onClick={() => setConfirmUnlinkOpen(true)}
          title="Remove from this course"
        >
          <Unlink className="h-3.5 w-3.5 mr-1" />
          Unlink Course
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 h-8"
          onClick={() => setConfirmDeleteOpen(true)}
          title="Delete person completely"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Delete
        </Button>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={confirmUnlinkOpen}
        onOpenChange={setConfirmUnlinkOpen}
        title="Remove Person from Course?"
        description={`This will unlink ${person.full_name} from this course. Their profile and connections in other courses will not be deleted.`}
        confirmLabel="Unlink Person"
        onConfirm={() => onUnlinkFromCourse(person.id)}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete Person Permanently?"
        description={`Are you sure you want to completely delete ${person.full_name}? This will remove them from all courses and your address book.`}
        confirmLabel="Delete Permanently"
        onConfirm={() => onDeletePerson(person.id)}
      />
    </div>
  );
}
