"use client";

import React, { useState } from "react";
import { Person, RelationshipType } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UserPlus, Link as LinkIcon } from "lucide-react";

interface AddPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availablePeople: Person[];
  courseId: string;
  onAddNewPerson: (data: {
    personData: {
      full_name: string;
      nickname?: string | null;
      email?: string | null;
      phone?: string | null;
      class_name?: string | null;
      major?: string | null;
      skills?: string[];
      notes?: string | null;
    };
    relationship: {
      relationship_type: RelationshipType;
      knowledge_topics?: string[];
      context_note?: string | null;
    };
  }) => Promise<void>;
  onLinkExistingPerson: (
    personId: string,
    relationship: {
      relationship_type: RelationshipType;
      knowledge_topics?: string[];
      context_note?: string | null;
    }
  ) => Promise<void>;
}

export function AddPersonDialog({
  open,
  onOpenChange,
  availablePeople,
  courseId,
  onAddNewPerson,
  onLinkExistingPerson,
}: AddPersonDialogProps) {
  const [tab, setTab] = useState<"new" | "existing">("new");

  // New person state
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [classNameVal, setClassNameVal] = useState("");
  const [major, setMajor] = useState("");
  const [skills, setSkills] = useState("");
  const [notes, setNotes] = useState("");

  // Existing person state
  const [selectedPersonId, setSelectedPersonId] = useState("");

  // Shared relationship state
  const [relType, setRelType] = useState<RelationshipType>("Classmate");
  const [topics, setTopics] = useState("");
  const [contextNote, setContextNote] = useState("");

  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setFullName("");
    setNickname("");
    setEmail("");
    setPhone("");
    setClassNameVal("");
    setMajor("");
    setSkills("");
    setNotes("");
    setSelectedPersonId("");
    setRelType("Classmate");
    setTopics("");
    setContextNote("");
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    setLoading(true);
    try {
      const skillsArr = skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const topicsArr = topics
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await onAddNewPerson({
        personData: {
          full_name: fullName.trim(),
          nickname: nickname.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          class_name: classNameVal.trim() || null,
          major: major.trim() || null,
          skills: skillsArr,
          notes: notes.trim() || null,
        },
        relationship: {
          relationship_type: relType,
          knowledge_topics: topicsArr,
          context_note: contextNote.trim() || null,
        },
      });
      resetForm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId) return;

    setLoading(true);
    try {
      const topicsArr = topics
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await onLinkExistingPerson(selectedPersonId, {
        relationship_type: relType,
        knowledge_topics: topicsArr,
        context_note: contextNote.trim() || null,
      });
      resetForm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Connect Person to Course
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(val) => setTab(val as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new" className="text-xs">
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              New Contact
            </TabsTrigger>
            <TabsTrigger value="existing" className="text-xs">
              <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
              Existing Library ({availablePeople.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: NEW PERSON */}
          <TabsContent value="new">
            <form onSubmit={handleCreateNew} className="space-y-3 pt-2 text-xs">
              <div className="space-y-1">
                <Label>Full Name *</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Nguyen Van A"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Nickname / Title</Label>
                  <Input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Prof. Nguyen, Alex"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Class / Group</Label>
                  <Input
                    value={classNameVal}
                    onChange={(e) => setClassNameVal(e.target.value)}
                    placeholder="Faculty, EE-K65"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@univ.edu"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+84 901..."
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Major / Department</Label>
                <Input
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  placeholder="Electrical Engineering"
                />
              </div>

              <div className="space-y-1">
                <Label>Skills (comma separated)</Label>
                <Input
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="MATLAB, Power World, Python"
                />
              </div>

              {/* Course Relationship Options */}
              <div className="pt-2 border-t border-border space-y-2">
                <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                  Role in this Course
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Relationship</Label>
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
                    <Label>Knowledge Topics</Label>
                    <Input
                      value={topics}
                      onChange={(e) => setTopics(e.target.value)}
                      placeholder="Load Flow, Stability"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Context Note</Label>
                  <Input
                    value={contextNote}
                    onChange={(e) => setContextNote(e.target.value)}
                    placeholder="e.g. Lab partner for assignment 2"
                  />
                </div>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading || !fullName.trim()}>
                  {loading ? "Adding..." : "Add to Course Graph"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* TAB 2: LINK EXISTING */}
          <TabsContent value="existing">
            <form onSubmit={handleLinkExisting} className="space-y-4 pt-2 text-xs">
              <div className="space-y-1">
                <Label>Select Contact from Library</Label>
                <Select
                  value={selectedPersonId}
                  onValueChange={setSelectedPersonId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a person..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePeople.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name} {p.class_name ? `(${p.class_name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Relationship Type for this Course</Label>
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
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="e.g. Power Electronics, Simulink"
                />
              </div>

              <div className="space-y-1">
                <Label>Context Note for this Course</Label>
                <Input
                  value={contextNote}
                  onChange={(e) => setContextNote(e.target.value)}
                  placeholder="e.g. Collaborating on final project"
                />
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading || !selectedPersonId}>
                  {loading ? "Connecting..." : "Link to Course"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
