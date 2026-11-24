'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  CopyPlus,
  GripVertical,
  Link2,
  PencilLine,
  Plus,
  Receipt,
  Share2,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { auth, db } from '@/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { getEffectiveUser } from '@/lib/impersonation';
import { addDoc, collection, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import {
  createEmptyBill,
  normalizeTripBill,
  billUsesTaxTip,
  sumBillSplits,
  aggregateExpensesFromBills,
  type TripBill,
} from '@/lib/tripLedger';
import { generateInviteCode } from '@/lib/inviteUtils';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Avatar,
  AvatarStack,
  Field,
  Money,
  Panel,
  Spinner,
  Switch,
  inputClass,
} from '@/components/app/primitives';

interface Person {
  name: string;
  phoneNumber?: string;
  paid?: boolean;
}

interface ItemSplit {
  personName: string;
  amount: number;
}

interface Item {
  name: string;
  totalAmount: number;
  splits: ItemSplit[];
  paidBy?: string;
}

/** Firestore rejects `undefined` values — strip nested objects (e.g. people.paid, bill.useTaxTip). */
function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined) {
      out[k] = typeof v === 'object' && v !== null ? stripUndefinedDeep(v) : v;
    }
  }
  return out as T;
}

/** Keep split order aligned with the People list (stable, predictable). */
function orderSplitNamesFromPeople(peopleList: { name: string }[], selected: string[]): string[] {
  const sel = new Set(selected);
  return peopleList.map((p) => p.name).filter((n) => sel.has(n));
}

/**
 * Distribute `total` equally across names; last person gets rounding remainder so the sum matches.
 */
function buildEqualSplits(names: string[], total: number): Map<string, number> {
  const m = new Map<string, number>();
  if (names.length === 0) return m;
  if (total === 0 || Number.isNaN(total)) {
    names.forEach((n) => m.set(n, 0));
    return m;
  }
  let assigned = 0;
  names.forEach((name, i) => {
    if (i === names.length - 1) {
      m.set(name, Number((total - assigned).toFixed(2)));
    } else {
      const part = Number((total / names.length).toFixed(2));
      m.set(name, part);
      assigned += part;
    }
  });
  return m;
}
function migrateDraftToBills(draftData: Record<string, unknown>): TripBill[] {
  const raw = draftData.bills;
  if (Array.isArray(raw) && raw.length > 0) {
    return (raw as TripBill[]).map(normalizeTripBill);
  }
  return [
    normalizeTripBill({
      id: 'legacy',
      label: (typeof draftData.title === 'string' ? draftData.title : '') || 'Receipt',
      items: (draftData.items as Item[]) || [],
      subtotal: typeof draftData.subtotal === 'number' ? draftData.subtotal : 0,
      total: typeof draftData.total === 'number' ? draftData.total : 0
    })
  ];
}


function MoneyInput({
  value,
  onChange,
  placeholder = '0.00',
  className,
  id,
  ariaLabel,
  autoFocus,
  allowNegative = true,
}: {
  value: number;
  onChange: (raw: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  allowNegative?: boolean;
}) {
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[15px] text-gray-400">$</span>
      <input
        id={id}
        type="number"
        step="0.01"
        {...(allowNegative ? {} : { min: 0, inputMode: 'decimal' as const })}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        value={value === 0 ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, 'pl-7 tabular-nums')}
      />
    </div>
  );
}

function LineItemSplitList({
  people,
  selectedPeople,
  customSplits,
  totalAmount,
  onToggle,
  onSplitAmountChange,
}: {
  people: { name: string }[];
  selectedPeople: string[];
  customSplits: Map<string, number>;
  totalAmount: number;
  onToggle: (name: string, checked: boolean) => void;
  onSplitAmountChange: (name: string, value: number) => void;
}) {
  const sum = useMemo(
    () => selectedPeople.reduce((s, n) => s + (customSplits.get(n) || 0), 0),
    [selectedPeople, customSplits]
  );
  const drift =
    selectedPeople.length > 0 && totalAmount !== 0 && Math.abs(sum - totalAmount) > 0.02;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {people.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">Add people in step 2 first.</p>
        ) : (
          <div className="max-h-[17rem] divide-y divide-gray-100 overflow-y-auto">
            {people.map((person, index) => {
              const isSelected = selectedPeople.includes(person.name);
              const splitAmount = customSplits.get(person.name) ?? 0;
              const id = `line-split-${index}`;
              return (
                <div
                  key={person.name}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 transition-colors',
                    isSelected ? 'bg-indigo-50/40' : 'bg-white'
                  )}
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggle(person.name, e.target.checked);
                    }}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={id}
                    className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-3 rounded-lg py-1 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500/40"
                  >
                    <span
                      className={cn(
                        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                        isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white'
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <Avatar name={person.name} size="sm" />
                    <span className={cn('truncate text-sm font-medium', isSelected ? 'text-gray-900' : 'text-gray-500')}>
                      {person.name}
                    </span>
                  </label>
                  {isSelected ? (
                    <div className="relative w-28 shrink-0">
                      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-gray-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={splitAmount === 0 ? '' : splitAmount}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          onSplitAmountChange(person.name, Number.isNaN(v) ? 0 : v);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-6 pr-2.5 text-right text-sm tabular-nums outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                        placeholder="0.00"
                        aria-label={`${person.name} share`}
                      />
                    </div>
                  ) : (
                    <span className="w-28 shrink-0 text-right text-xs text-gray-300">Not splitting</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {selectedPeople.length > 0 && totalAmount !== 0 && (
        <p
          className={cn(
            'mt-2 flex items-center gap-1.5 text-xs',
            drift ? 'font-medium text-amber-700' : 'text-gray-500'
          )}
        >
          {drift ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
          Shares add up to {formatMoney(sum)}
          {drift ? ` but the item is ${formatMoney(totalAmount)}` : ''}
        </p>
      )}
    </>
  );
}

function SortableExpenseBlock({
  id,
  children,
}: {
  id: string;
  children: (drag: {
    setActivatorNodeRef: (el: HTMLElement | null) => void;
    attributes: DraggableAttributes;
    listeners: Record<string, unknown>;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, setActivatorNodeRef } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'relative z-20 rounded-3xl opacity-[0.97] shadow-2xl ring-2 ring-indigo-300/50' : ''}
    >
      {children({
        setActivatorNodeRef,
        attributes,
        listeners: (listeners ?? {}) as Record<string, unknown>,
      })}
    </div>
  );
}

function SortableLineItemBlock({
  id,
  children,
}: {
  id: string;
  children: (drag: {
    setActivatorNodeRef: (el: HTMLElement | null) => void;
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners | undefined;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, setActivatorNodeRef } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/line relative bg-white',
        isDragging && 'z-20 rounded-2xl shadow-lg ring-2 ring-indigo-200'
      )}
    >
      {children({ setActivatorNodeRef, attributes, listeners })}
    </li>
  );
}

const STEPS = [
  { number: 1, title: 'Details' },
  { number: 2, title: 'People' },
  { number: 3, title: 'Expenses' },
  { number: 4, title: 'Review' },
];

function CreateTabContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  
  // Form data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venmoUsername, setVenmoUsername] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  /** Multiple meals / receipts in one trip — each has its own items + tip/tax. */
  const [bills, setBills] = useState<TripBill[]>([createEmptyBill()]);
  
  // Form states for adding new entries
  const [newPersonName, setNewPersonName] = useState('');
  const [savedPeople, setSavedPeople] = useState<string[]>([]); // People saved in user profile
  const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    totalAmount: 0,
    customSplits: new Map<string, number>(),
    paidBy: '',
  });
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  /** Which bill the item dialog applies to */
  const [itemTargetBillId, setItemTargetBillId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ billId: string; index: number } | null>(null);
  const [, setIsAddPersonOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  
  // Draft management / existing document id (draft or active tab being edited)
  const [draftId, setDraftId] = useState<string | null>(null);
  /** True when editing a published tab — auto-save keeps status active and preserves payment state. */
  const [isEditingActiveTab, setIsEditingActiveTab] = useState(false);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  /** True if the current user owns this tab; false if they're a collaborator. */
  const [isOwner, setIsOwner] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialLoadRef = useRef(false);

  const billSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleBillsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBills((items) => {
      const oldIndex = items.findIndex((b) => b.id === active.id);
      const newIndex = items.findIndex((b) => b.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.push('/login');
    });
    return () => unsubscribe();
  }, [router]);

  // Load user profile and existing draft on mount
  useEffect(() => {
    const loadUserData = async () => {
      const user = getEffectiveUser();
      if (!user || hasInitialLoadRef.current) return;

      try {
        setIsLoadingDraft(true);
        
        // Load user profile to get venmo username and saved people
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setVenmoUsername(userData.venmoUsername || '');
          // Load saved people from user profile
          if (userData.savedPeople && Array.isArray(userData.savedPeople)) {
            setSavedPeople(userData.savedPeople);
          }
        }
        
        const editIdParam = searchParams.get('editId');
        const draftIdParam = searchParams.get('draftId');

        if (editIdParam) {
          const tabRef = doc(db, 'tabs', editIdParam);
          const tabSnap = await getDoc(tabRef);
          if (tabSnap.exists()) {
            const tabData = tabSnap.data();
            const userIsOwner = tabData.userId === user.uid;
            const userIsMember = (tabData.memberIds || []).includes(user.uid);
            if (userIsOwner || userIsMember) {
              setIsOwner(userIsOwner);
              setInviteCode(tabData.inviteCode || null);
              setDraftId(editIdParam);
              setIsEditingActiveTab(tabData.status === 'active');
              setTitle(tabData.title || '');
              setDescription(tabData.description || '');
              setVenmoUsername(tabData.venmoUsername || userSnap.data()?.venmoUsername || '');
              setPeople(
                (tabData.people || []).map((p: { name: string; paid?: boolean; phoneNumber?: string }) => ({
                  name: p.name,
                  paid: p.paid,
                  phoneNumber: p.phoneNumber
                }))
              );
              setBills(migrateDraftToBills(tabData as Record<string, unknown>));
            } else {
              setEditLoadError('You need an invite to edit this tab.');
            }
          } else {
            setEditLoadError('That tab could not be found.');
          }
        } else if (draftIdParam) {
          const draftRef = doc(db, 'tabs', draftIdParam);
          const draftSnap = await getDoc(draftRef);

          if (draftSnap.exists()) {
            const draftData = draftSnap.data();
            const userIsOwner = draftData.userId === user.uid;
            const userIsMember = (draftData.memberIds || []).includes(user.uid);
            if (draftData.status === 'draft' && (userIsOwner || userIsMember)) {
              setIsOwner(userIsOwner);
              setInviteCode(draftData.inviteCode || null);
              setDraftId(draftIdParam);
              setIsEditingActiveTab(false);
              setTitle(draftData.title || '');
              setDescription(draftData.description || '');
              setVenmoUsername(draftData.venmoUsername || userSnap.data()?.venmoUsername || '');
              setPeople(
                (draftData.people || []).map((p: { name: string; paid?: boolean; phoneNumber?: string }) => ({
                  name: p.name,
                  paid: p.paid,
                  phoneNumber: p.phoneNumber
                }))
              );
              setBills(migrateDraftToBills(draftData as Record<string, unknown>));
            }
          }
        }
        hasInitialLoadRef.current = true;
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoadingDraft(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadUserData();
      }
    });

    return () => unsubscribe();
  }, [router, searchParams]);

  // Auto-save function
  const autoSave = useCallback(async () => {
    const user = getEffectiveUser();
    if (!user) return;

    // Don't create an empty draft just for opening the page (the Venmo username is prefilled from the profile).
    if (!title && !description && people.length === 0 && bills.every(b => b.items.length === 0 && !b.label.trim())) {
      return;
    }

    setSaveState('saving');
    try {
      if (draftId) {
        const draftRef = doc(db, 'tabs', draftId);
        const updateData = isOwner
          ? {
              userId: user.uid,
              title,
              description,
              venmoUsername,
              people: stripUndefinedDeep(people),
              bills: stripUndefinedDeep(bills),
              status: isEditingActiveTab ? ('active' as const) : ('draft' as const),
              updatedAt: serverTimestamp(),
            }
          : {
              title,
              description,
              people: stripUndefinedDeep(people),
              bills: stripUndefinedDeep(bills),
              updatedAt: serverTimestamp(),
            };
        await updateDoc(draftRef, updateData);
      } else if (isOwner) {
        const docRef = await addDoc(collection(db, 'tabs'), {
          userId: user.uid,
          title,
          description,
          venmoUsername,
          people: stripUndefinedDeep(people),
          bills: stripUndefinedDeep(bills),
          status: 'draft' as const,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setDraftId(docRef.id);
      }
      setSaveState('saved');
    } catch (error) {
      console.error('Error auto-saving draft:', error);
      setSaveState('error');
    }
  }, [title, description, venmoUsername, people, bills, draftId, isEditingActiveTab, isOwner]);

  const handleShare = async () => {
    if (inviteCode) { setShareOpen(true); return; }
    if (!draftId) return;
    setIsGeneratingCode(true);
    const code = generateInviteCode();
    try {
      await updateDoc(doc(db, 'tabs', draftId), { inviteCode: code });
      setInviteCode(code);
    } catch (e) { console.error(e); }
    setIsGeneratingCode(false);
    setShareOpen(true);
  };

  const handleCopyInvite = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  // Debounced auto-save
  useEffect(() => {
    if (isLoadingDraft || !hasInitialLoadRef.current) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [title, description, venmoUsername, people, bills, autoSave, isLoadingDraft]);

  const handleAddPerson = async (personNameOverride?: string) => {
    try {
      const nameToUse = personNameOverride || newPersonName;
      if (!nameToUse) {
        console.log('No name provided');
        return;
      }
      
      const personName = typeof nameToUse === 'string' ? nameToUse.trim() : String(nameToUse).trim();
      if (!personName) {
        console.log('Name is empty after trim');
        return;
      }

      const user = getEffectiveUser();
      if (!user) {
        console.log('No user found');
        return;
      }

      // Check if person already exists in current tab
      if (people.some(p => p.name.toLowerCase() === personName.toLowerCase())) {
        console.log('Person already exists');
        setNewPersonName('');
        setShowPersonSuggestions(false);
        setIsAddPersonOpen(false);
        return;
      }

      // Add person to current tab
      setPeople([...people, { name: personName }]);
      
      // Save person to user profile if not already saved
      const normalizedPersonName = personName.toLowerCase();
      if (!savedPeople.some(p => p.toLowerCase() === normalizedPersonName)) {
        try {
          const updatedSavedPeople = [...savedPeople, personName];
          setSavedPeople(updatedSavedPeople);
          
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            savedPeople: updatedSavedPeople,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          console.error('Error saving person to profile:', error);
        }
      }
      
      setNewPersonName('');
      setShowPersonSuggestions(false);
      setIsAddPersonOpen(false);
    } catch (error) {
      console.error('Error in handleAddPerson:', error);
    }
  };

  // Filter suggestions based on input and exclude already added people
  const filteredPersonSuggestions = React.useMemo(() => {
    const searchTerm = newPersonName.trim().toLowerCase();
    const alreadyAdded = people.map(p => p.name);
    
    if (searchTerm) {
      return savedPeople.filter(name => 
        name.toLowerCase().includes(searchTerm) &&
        !alreadyAdded.includes(name)
      );
    }
    return savedPeople.filter(name => !alreadyAdded.includes(name));
  }, [newPersonName, savedPeople, people]);

  const handleDeletePerson = (index: number) => {
    setPeople(people.filter((_, i) => i !== index));
  };

  const togglePersonInSplit = (personName: string, checked: boolean) => {
    setSelectedPeople((prev) => {
      let nextRaw: string[];
      if (checked) {
        nextRaw = prev.includes(personName) ? prev : [...prev, personName];
      } else {
        nextRaw = prev.filter((p) => p !== personName);
      }
      const ordered = orderSplitNamesFromPeople(people, nextRaw);
      setNewItem((item) => ({
        ...item,
        customSplits: buildEqualSplits(ordered, item.totalAmount),
      }));
      return ordered;
    });
  };

  const selectAllPeopleForLineItem = () => {
    const ordered = people.map((p) => p.name);
    setSelectedPeople(ordered);
    setNewItem((item) => ({
      ...item,
      customSplits: buildEqualSplits(ordered, item.totalAmount),
    }));
  };

  const clearPeopleForLineItem = () => {
    setSelectedPeople([]);
    setNewItem((item) => ({ ...item, customSplits: new Map() }));
  };

  const handleAddItem = () => {
    const billId = editingItem?.billId ?? itemTargetBillId;
    if (
      !billId ||
      !newItem.name.trim() ||
      newItem.totalAmount === 0 ||
      Number.isNaN(newItem.totalAmount) ||
      selectedPeople.length === 0
    )
      return;

    const splits = Array.from(newItem.customSplits.entries())
      .filter(([name]) => selectedPeople.includes(name))
      .map(([personName, amount]) => ({
        personName,
        amount: Number(amount.toFixed(2))
      }));

    const entry: Item = {
      name: newItem.name,
      totalAmount: newItem.totalAmount,
      splits,
      ...(newItem.paidBy.trim() && newItem.totalAmount > 0 ? { paidBy: newItem.paidBy.trim() } : {}),
    };

    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== billId) return b;
        if (editingItem && editingItem.billId === billId) {
          const next = [...b.items];
          next[editingItem.index] = entry;
          return { ...b, items: next };
        }
        return { ...b, items: [...b.items, entry] };
      })
    );

    setNewItem({ name: '', totalAmount: 0, customSplits: new Map(), paidBy: '' });
    setSelectedPeople([]);
    setEditingItem(null);
    setItemTargetBillId(null);
    setIsAddItemOpen(false);
  };

  const handleDeleteItem = (billId: string, index: number) => {
    setBills((prev) =>
      prev.map((b) => (b.id === billId ? { ...b, items: b.items.filter((_, i) => i !== index) } : b))
    );
  };

  const handleDuplicateItem = (billId: string, index: number) => {
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== billId) return b;
        if (index < 0 || index >= b.items.length) return b;
        const source = b.items[index];
        const duplicate: Item = {
          ...source,
          name: source.name?.trim() ? `${source.name} (copy)` : 'Line item (copy)',
          splits: source.splits.map((s) => ({ ...s })),
        };
        const next = [...b.items];
        next.splice(index + 1, 0, duplicate);
        return { ...b, items: next };
      })
    );
  };

  const parseLineDragIndex = (billId: string, dragId: string): number => {
    const prefix = `${billId}-line-`;
    if (!dragId.startsWith(prefix)) return -1;
    const idx = Number(dragId.slice(prefix.length));
    return Number.isInteger(idx) ? idx : -1;
  };

  const handleLineItemDragEnd = useCallback((billId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = parseLineDragIndex(billId, String(active.id));
    const toIndex = parseLineDragIndex(billId, String(over.id));
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== billId) return b;
        if (fromIndex >= b.items.length || toIndex >= b.items.length) return b;
        const next = [...b.items];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return { ...b, items: next };
      })
    );
  }, []);

  const openAddItem = (billId: string) => {
    setItemTargetBillId(billId);
    setEditingItem(null);
    const everyone = people.map((p) => p.name);
    setSelectedPeople(everyone);
    setNewItem({ name: '', totalAmount: 0, customSplits: new Map(), paidBy: '' });
    setIsAddItemOpen(true);
  };

  const handleEditItem = (billId: string, index: number) => {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;
    const item = bill.items[index];
    const customSplits = new Map(item.splits.map((split) => [split.personName, split.amount]));
    setNewItem({
      name: item.name,
      totalAmount: item.totalAmount,
      customSplits,
      paidBy: item.paidBy ?? '',
    });
    setSelectedPeople(orderSplitNamesFromPeople(people, item.splits.map((s) => s.personName)));
    setEditingItem({ billId, index });
    setItemTargetBillId(billId);
    setIsAddItemOpen(true);
  };

  const calculateTipTaxForBill = (billId: string) => {
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== billId) return b;
        if (!billUsesTaxTip(b)) return b;
        if (b.subtotal <= 0 || b.total <= 0 || b.total <= b.subtotal) return b;
        const multiplier = b.total / b.subtotal;
        const personTotals = new Map<string, number>();
        b.items
          .filter((item) => item.name !== 'Tip & Tax')
          .forEach((item) => {
            item.splits.forEach((split) => {
              const currentTotal = personTotals.get(split.personName) || 0;
              personTotals.set(split.personName, currentTotal + split.amount);
            });
          });
        const tipTaxItem: Item = {
          name: 'Tip & Tax',
          totalAmount: b.total - b.subtotal,
          splits: Array.from(personTotals.entries()).map(([name, amount]) => ({
            personName: name,
            amount: Number((amount * (multiplier - 1)).toFixed(2))
          })),
          ...(b.paidBy?.trim() ? { paidBy: b.paidBy.trim() } : {}),
        };
        const filteredItems = b.items.filter((item) => item.name !== 'Tip & Tax');
        return { ...b, items: [...filteredItems, tipTaxItem] };
      })
    );
  };

  const addExpenseBill = () => {
    setBills((prev) => [...prev, createEmptyBill()]);
  };

  const removeExpenseBill = (billId: string) => {
    setBills((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.id !== billId)));
  };

  const updateBillField = (
    billId: string,
    patch: Partial<Pick<TripBill, 'label' | 'subtotal' | 'total' | 'useTaxTip' | 'paidBy'>>
  ) => {
    setBills((prev) => prev.map((b) => (b.id === billId ? { ...b, ...patch } : b)));
  };

  const setBillUseTaxTip = (billId: string, on: boolean) => {
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== billId) return b;
        if (!on) {
          return {
            ...b,
            useTaxTip: false,
            subtotal: 0,
            total: 0,
            items: b.items.filter((i) => i.name !== 'Tip & Tax')
          };
        }
        return { ...b, useTaxTip: true };
      })
    );
  };

  const handleSubmit = async () => {
    try {
      const userId = getEffectiveUser()?.uid;
      if (!userId) return;

      const tabData = {
        userId,
        title,
        description,
        venmoUsername,
        people: stripUndefinedDeep(people),
        bills: stripUndefinedDeep(bills),
        status: 'active' as const,
        updatedAt: serverTimestamp()
      };

      if (draftId) {
        const draftRef = doc(db, 'tabs', draftId);
        if (isEditingActiveTab) {
          await updateDoc(draftRef, tabData);
        } else {
          await updateDoc(draftRef, {
            ...tabData,
            createdAt: serverTimestamp()
          });
        }
        router.push(`/tab/${draftId}`);
      } else {
        const docRef = await addDoc(collection(db, 'tabs'), {
          ...tabData,
          createdAt: serverTimestamp()
        });
        router.push(`/tab/${docRef.id}`);
      }
    } catch (error) {
      console.error('Error creating tab:', error);
    }
  };

  const billsReady = () =>
    bills.every((b) => {
      const hasLines =
        b.label.trim() !== '' && b.items.filter((i) => i.name !== 'Tip & Tax').length > 0;
      if (!hasLines) return false;
      if (!billUsesTaxTip(b)) return true;
      return (
        b.subtotal > 0 &&
        b.total > b.subtotal &&
        b.items.some((i) => i.name === 'Tip & Tax')
      );
    });

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        return title.trim() !== '';
      case 2:
        return people.length > 0;
      case 3:
        return billsReady();
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (canProceedToNextStep() && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 4) {
      setCurrentStep(step);
    }
  };

  /* ------------------------------------------------------------ view state */

  const [submitting, setSubmitting] = useState(false);

  // Each step starts at the top of the page.
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      await handleSubmit();
    } finally {
      setSubmitting(false);
    }
  };

  const splitEvenly = () => {
    const ordered = orderSplitNamesFromPeople(people, selectedPeople);
    setNewItem((item) => ({ ...item, customSplits: buildEqualSplits(ordered, item.totalAmount) }));
  };

  const personTotals = useMemo(() => {
    const map = aggregateExpensesFromBills(bills, people.map((p) => p.name));
    return people.map((p) => ({
      name: p.name,
      owes: Object.values(map[p.name] || {}).reduce((s, v) => s + v, 0),
    }));
  }, [bills, people]);

  const tripTotal = useMemo(() => bills.reduce((s, b) => s + sumBillSplits(b), 0), [bills]);

  const lineItemsOf = (bill: TripBill) =>
    bill.items.map((item, index) => ({ item, index })).filter(({ item }) => item.name !== 'Tip & Tax');

  const billIssue = (b: TripBill): string | null => {
    if (b.label.trim() === '') return 'Give this expense a name';
    if (lineItemsOf(b).length === 0) return 'Add at least one item';
    if (!billUsesTaxTip(b)) return null;
    if (!(b.subtotal > 0) || !(b.total > b.subtotal)) return 'Enter the subtotal and a larger receipt total';
    if (!b.items.some((i) => i.name === 'Tip & Tax')) return 'Apply tax & tip';
    return null;
  };

  const blockedReason = (): string | null => {
    switch (currentStep) {
      case 1:
        return title.trim() === '' ? 'Give your tab a name to continue' : null;
      case 2:
        return people.length === 0 ? 'Add at least one person to continue' : null;
      case 3: {
        const idx = bills.findIndex((b) => billIssue(b) !== null);
        if (idx < 0) return null;
        const b = bills[idx];
        return `${b.label.trim() || `Expense ${idx + 1}`}: ${billIssue(b)}`;
      }
      default:
        if (!isOwner) return null;
        if (!venmoUsername) return 'Add your Venmo username in Settings before sending';
        if (!title || people.length === 0 || !billsReady()) return 'Finish the earlier steps first';
        return null;
    }
  };

  const closeItemDialog = () => {
    setIsAddItemOpen(false);
    setNewItem({ name: '', totalAmount: 0, customSplits: new Map(), paidBy: '' });
    setSelectedPeople([]);
    setEditingItem(null);
    setItemTargetBillId(null);
  };

  const shareUrl = typeof window !== 'undefined' && inviteCode ? `${window.location.origin}/join/${inviteCode}` : '';

  /* --------------------------------------------------------------- loading */

  if (isLoadingDraft) {
    return (
      <div className="min-h-screen tw-app-bg">
        <Navbar />
        <main className="flex min-h-[60vh] items-center justify-center">
          <Spinner className="h-8 w-8" />
        </main>
      </div>
    );
  }

  if (editLoadError) {
    return (
      <div className="min-h-screen tw-app-bg">
        <Navbar />
        <main className="mx-auto max-w-md px-4 pt-24">
          <Panel className="p-8 text-center">
            <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <AlertCircle className="h-5 w-5" />
            </span>
            <p className="text-[17px] font-semibold text-gray-900">{editLoadError}</p>
            <Button className="mt-6" onClick={() => router.push('/tabs')}>
              Back to my tabs
            </Button>
          </Panel>
        </main>
      </div>
    );
  }

  const heading = !isOwner
    ? title || 'Shared tab'
    : isEditingActiveTab
      ? 'Edit tab'
      : draftId
        ? 'Draft'
        : 'New tab';

  const reason = blockedReason();

  /* ------------------------------------------------------------ the page */

  return (
    <div className="min-h-screen tw-app-bg">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pb-40 pt-8 sm:pt-10">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={isEditingActiveTab && draftId ? `/tab/${draftId}` : '/tabs'}
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              {isEditingActiveTab && draftId ? 'Back to tab' : 'My tabs'}
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-3xl font-semibold tracking-[-0.02em] text-gray-900">{heading}</h1>
              <SaveIndicator state={saveState} active={isEditingActiveTab} hasDoc={!!draftId} />
            </div>
            {!isOwner && (
              <p className="mt-1.5 text-sm text-gray-500">
                You&apos;re a collaborator. Add the people and expenses you covered.
              </p>
            )}
          </div>
          {isOwner && draftId && !isEditingActiveTab && (
            <Button variant="outline" onClick={handleShare} disabled={isGeneratingCode}>
              {isGeneratingCode ? <Spinner className="h-4 w-4 border-[1.5px]" /> : <UserPlus />}
              {inviteCode ? 'Invite link' : 'Invite collaborators'}
            </Button>
          )}
        </div>

        {/* Stepper */}
        <nav aria-label="Steps" className="mb-6">
          <ol className="grid grid-cols-4 gap-1.5 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {STEPS.map((step) => {
              const active = currentStep === step.number;
              const done = currentStep > step.number;
              return (
                <li key={step.number}>
                  <button
                    type="button"
                    onClick={() => goToStep(step.number)}
                    aria-current={active ? 'step' : undefined}
                    aria-label={`Step ${step.number}: ${step.title}`}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2 text-sm font-medium transition-all',
                      active
                        ? 'bg-gray-900 text-white shadow-sm'
                        : done
                          ? 'text-gray-700 hover:bg-gray-50'
                          : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                        active
                          ? 'bg-white/20 text-white'
                          : done
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-100 text-gray-400'
                      )}
                    >
                      {done ? <Check className="h-3 w-3" strokeWidth={3.5} /> : step.number}
                    </span>
                    <span className="hidden sm:inline">{step.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className={cn('grid items-start gap-6', currentStep < STEPS.length && 'lg:grid-cols-[minmax(0,1fr)_18rem]')}>
          {/* Step content */}
          <div key={currentStep} className="tw-app-rise min-w-0">
            {/* ------------------------------------------------ Step 1 */}
            {currentStep === 1 && (
              <Panel className="p-6 sm:p-8">
                <StepTitle
                  eyebrow="Step 1"
                  title="What's this tab for?"
                  sub="One link for the whole night, or the whole trip. You'll add each receipt in a minute."
                />
                <div className="space-y-5">
                  <Field label="Name" htmlFor="tab-title">
                    <input
                      id="tab-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={cn(inputClass, 'py-3 text-[17px] font-medium')}
                      placeholder="e.g. Friday at Kang Ho Dong, Weekend in Austin"
                      autoFocus={!title}
                      required
                    />
                  </Field>
                  <Field label="Description" htmlFor="tab-desc" optional>
                    <input
                      id="tab-desc"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={inputClass}
                      placeholder="A note everyone will see at the top"
                    />
                  </Field>

                  {venmoUsername ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3.5">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#008CFF]/10 text-[#008CFF]">
                        <Wallet className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          Payments go to <span className="font-semibold">@{venmoUsername.replace(/^@/, '')}</span>
                        </p>
                        <p className="text-xs text-gray-500">Everyone&apos;s Venmo button is prefilled with this.</p>
                      </div>
                      {isOwner && (
                        <Link href="/settings" className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-800">
                          Change
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-3.5">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-amber-900">Add your Venmo username</p>
                        <p className="text-xs text-amber-800/80">You&apos;ll need it before sending the tab, so people know where to pay.</p>
                      </div>
                      <Link href="/settings" className="shrink-0 text-sm font-semibold text-amber-900 underline underline-offset-2">
                        Settings
                      </Link>
                    </div>
                  )}
                </div>
              </Panel>
            )}

            {/* ------------------------------------------------ Step 2 */}
            {currentStep === 2 && (
              <Panel className="p-6 sm:p-8">
                <StepTitle eyebrow="Step 2" title="Who's on the tab?" sub="Include yourself if you're splitting too." />

                <form
                  className="relative"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddPerson();
                  }}
                >
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Type a name"
                        aria-label="Person's name"
                        value={newPersonName}
                        onChange={(e) => {
                          setNewPersonName(e.target.value);
                          if (savedPeople.length > 0) setShowPersonSuggestions(true);
                        }}
                        onFocus={() => {
                          if (savedPeople.length > 0 && newPersonName.trim()) setShowPersonSuggestions(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setShowPersonSuggestions(false);
                        }}
                        onBlur={() => setTimeout(() => setShowPersonSuggestions(false), 150)}
                        className={inputClass}
                        autoFocus
                        autoComplete="off"
                      />
                      {showPersonSuggestions && newPersonName.trim() && filteredPersonSuggestions.length > 0 && (
                        <div className="absolute z-30 mt-1.5 max-h-60 w-full overflow-auto rounded-2xl border border-gray-100 bg-white p-1.5 shadow-[0_16px_50px_-20px_rgba(15,23,42,0.35)]">
                          {filteredPersonSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleAddPerson(suggestion);
                              }}
                              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Avatar name={suggestion} size="xs" />
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button type="submit" className="h-auto rounded-xl px-5" disabled={!newPersonName.trim()}>
                      <Plus />
                      Add
                    </Button>
                  </div>
                  {newPersonName.trim() &&
                    people.some((p) => p.name.toLowerCase() === newPersonName.trim().toLowerCase()) && (
                      <p className="mt-2 text-xs text-amber-700">{newPersonName.trim()} is already on this tab.</p>
                    )}
                </form>

                {filteredPersonSuggestions.length > 0 && (
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-medium text-gray-400">
                      {newPersonName.trim() ? 'Matching people' : 'People you’ve split with'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {filteredPersonSuggestions.slice(0, 16).map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => handleAddPerson(name)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 text-sm text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
                        >
                          <Avatar name={name} size="xs" />
                          {name}
                          <Plus className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-7">
                  {people.length === 0 ? (
                    <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center">
                      <Users className="mb-3 h-6 w-6 text-gray-300" />
                      <p className="text-sm text-gray-500">No one yet. Add everyone who&apos;s splitting.</p>
                    </div>
                  ) : (
                    <>
                      <p className="mb-2 text-xs font-medium text-gray-400">
                        {people.length} {people.length === 1 ? 'person' : 'people'}
                      </p>
                      <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100">
                        {people.map((person, index) => (
                          <li key={person.name} className="flex items-center gap-3 bg-white px-4 py-2.5">
                            <Avatar name={person.name} size="md" />
                            <span className="flex-1 truncate text-[15px] font-medium text-gray-900">{person.name}</span>
                            {person.paid && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                Paid
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeletePerson(index)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                              aria-label={`Remove ${person.name}`}
                              title="Remove"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </Panel>
            )}

            {/* ------------------------------------------------ Step 3 */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="px-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Step 3</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-gray-900">Add each receipt</h2>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500">
                    One card per receipt. Turn on tax &amp; tip for restaurant checks; leave it off for gas, groceries, or
                    anything already final. Drag the handle to reorder.
                  </p>
                </div>

                <DndContext sensors={billSensors} collisionDetection={closestCenter} onDragEnd={handleBillsDragEnd}>
                  <SortableContext items={bills.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {bills.map((bill, billIdx) => {
                        const lines = lineItemsOf(bill);
                        const tipTax = bill.items.find((i) => i.name === 'Tip & Tax');
                        const itemsSum = lines.reduce((s, { item }) => s + item.totalAmount, 0);
                        const usesTaxTip = billUsesTaxTip(bill);
                        const issue = billIssue(bill);
                        return (
                          <SortableExpenseBlock key={bill.id} id={bill.id}>
                            {(drag) => (
                              <Panel className="overflow-hidden">
                                {/* bill header */}
                                <div className="flex items-start gap-2 px-4 pb-3 pt-4 sm:px-5">
                                  <button
                                    type="button"
                                    className="mt-1.5 shrink-0 cursor-grab touch-none rounded-lg p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing"
                                    ref={drag.setActivatorNodeRef}
                                    aria-label="Drag to reorder expenses"
                                    title="Drag to reorder"
                                    {...drag.attributes}
                                    {...drag.listeners}
                                  >
                                    <GripVertical className="h-5 w-5" aria-hidden />
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <label
                                      htmlFor={`bill-label-${bill.id}`}
                                      className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400"
                                    >
                                      Expense {billIdx + 1}
                                    </label>
                                    <input
                                      id={`bill-label-${bill.id}`}
                                      type="text"
                                      value={bill.label}
                                      onChange={(e) => updateBillField(bill.id, { label: e.target.value })}
                                      placeholder="Name it, e.g. Dinner at Luigi's"
                                      className="mt-0.5 w-full rounded-lg border-0 bg-transparent px-0 py-0.5 text-lg font-semibold tracking-tight text-gray-900 outline-none placeholder:font-medium placeholder:text-gray-300 focus:ring-0"
                                    />
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <Money
                                      amount={sumBillSplits(bill)}
                                      className="mt-1.5 text-lg font-semibold tracking-tight text-gray-900"
                                    />
                                    {bills.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeExpenseBill(bill.id)}
                                        className="ml-1 mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                                        aria-label={`Remove ${bill.label || `expense ${billIdx + 1}`}`}
                                        title="Remove expense"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* who paid */}
                                {people.length > 0 && (
                                  <div className="mx-4 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-gray-50 px-3.5 py-2.5 sm:mx-5">
                                    <span className="text-sm text-gray-500">Paid by</span>
                                    <select
                                      value={bill.paidBy ?? ''}
                                      onChange={(e) =>
                                        updateBillField(bill.id, { paidBy: e.target.value ? e.target.value : undefined })
                                      }
                                      aria-label="Who paid for this whole expense"
                                      className="min-w-0 flex-1 cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 sm:max-w-xs sm:flex-none"
                                    >
                                      <option value="">No one in particular (just split it)</option>
                                      {people.map((p) => (
                                        <option key={p.name} value={p.name}>
                                          {p.name}
                                        </option>
                                      ))}
                                    </select>
                                    <span className="w-full text-xs text-gray-400 sm:w-auto sm:flex-1">
                                      {bill.paidBy
                                        ? `${bill.paidBy} gets credit for every item unless one says otherwise.`
                                        : 'Pick someone if they fronted the whole receipt.'}
                                    </span>
                                  </div>
                                )}

                                {/* items */}
                                <div className="border-t border-gray-100">
                                  {lines.length > 0 && (
                                    <DndContext
                                      sensors={billSensors}
                                      collisionDetection={closestCenter}
                                      onDragEnd={(event) => handleLineItemDragEnd(bill.id, event)}
                                    >
                                      <SortableContext
                                        items={lines.map(({ index }) => `${bill.id}-line-${index}`)}
                                        strategy={verticalListSortingStrategy}
                                      >
                                        <ul className="divide-y divide-gray-100">
                                          {lines.map(({ item, index }) => {
                                            const payer = item.paidBy || bill.paidBy;
                                            const names = item.splits.map((s) => s.personName);
                                            const everyone = names.length === people.length && people.length > 1;
                                            return (
                                              <SortableLineItemBlock key={`${bill.id}-${index}`} id={`${bill.id}-line-${index}`}>
                                                {(lineDrag) => (
                                                  <div className="flex items-center gap-2 py-2.5 pl-3 pr-3 sm:pl-4 sm:pr-4">
                                                    <button
                                                      type="button"
                                                      className="shrink-0 cursor-grab touch-none rounded-md p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing"
                                                      ref={lineDrag.setActivatorNodeRef}
                                                      aria-label="Drag to reorder item"
                                                      title="Drag to reorder"
                                                      {...lineDrag.attributes}
                                                      {...lineDrag.listeners}
                                                    >
                                                      <GripVertical className="h-4 w-4" aria-hidden />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleEditItem(bill.id, index)}
                                                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-0.5 text-left"
                                                    >
                                                      <div className="min-w-0 flex-1">
                                                        <p className="truncate text-[15px] font-medium text-gray-900">{item.name}</p>
                                                        <p className="truncate text-xs text-gray-400">
                                                          {everyone ? 'Everyone' : names.join(', ') || 'No one'}
                                                          {payer && (
                                                            <>
                                                              {' · '}
                                                              <span className="text-gray-500">
                                                                {payer} paid{item.paidBy && bill.paidBy && item.paidBy !== bill.paidBy ? ' this one' : ''}
                                                              </span>
                                                            </>
                                                          )}
                                                        </p>
                                                      </div>
                                                      <span className="hidden sm:block">
                                                        <AvatarStack names={names} max={3} />
                                                      </span>
                                                      <span className="w-20 shrink-0 text-right">
                                                        <Money amount={item.totalAmount} className="text-[15px] font-semibold text-gray-900" />
                                                        {item.totalAmount < 0 && (
                                                          <span className="block text-[11px] text-sky-600">credit</span>
                                                        )}
                                                      </span>
                                                    </button>
                                                    <div className="flex shrink-0 items-center opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within/line:opacity-100 sm:group-hover/line:opacity-100">
                                                      <IconAction label={`Edit ${item.name}`} className="hidden sm:inline-flex" onClick={() => handleEditItem(bill.id, index)}>
                                                        <PencilLine />
                                                      </IconAction>
                                                      <IconAction label={`Duplicate ${item.name}`} onClick={() => handleDuplicateItem(bill.id, index)}>
                                                        <CopyPlus />
                                                      </IconAction>
                                                      <IconAction label={`Delete ${item.name}`} danger onClick={() => handleDeleteItem(bill.id, index)}>
                                                        <Trash2 />
                                                      </IconAction>
                                                    </div>
                                                  </div>
                                                )}
                                              </SortableLineItemBlock>
                                            );
                                          })}
                                        </ul>
                                      </SortableContext>
                                    </DndContext>
                                  )}
                                  {tipTax && (
                                    <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50/60 py-2.5 pl-12 pr-4 sm:pl-[3.25rem]">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-700">Tax &amp; tip</p>
                                        <p className="text-xs text-gray-400">Split in proportion to what each person ordered</p>
                                      </div>
                                      <Money amount={tipTax.totalAmount} className="w-20 text-right text-sm font-semibold text-gray-700" />
                                      <span className="w-[6.5rem] shrink-0 sm:w-[6.75rem]" />
                                    </div>
                                  )}
                                  <div className="border-t border-gray-100 p-2">
                                    <button
                                      type="button"
                                      onClick={() => openAddItem(bill.id)}
                                      disabled={people.length === 0}
                                      className="flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                                    >
                                      <Plus className="h-4 w-4" />
                                      {lines.length === 0 ? 'Add the first item' : 'Add item'}
                                    </button>
                                    {people.length === 0 && (
                                      <p className="pb-1 text-center text-xs text-gray-400">Add people in step 2 first.</p>
                                    )}
                                  </div>
                                </div>

                                {/* tax & tip */}
                                <div className="border-t border-gray-100 px-4 py-4 sm:px-5">
                                  <div className="flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                      <label htmlFor={`taxtip-${bill.id}`} className="block cursor-pointer text-sm font-medium text-gray-900">
                                        Separate tax &amp; tip
                                      </label>
                                      <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                                        For restaurants: enter items before tax, then the receipt&apos;s subtotal and final total.
                                      </p>
                                    </div>
                                    <Switch
                                      id={`taxtip-${bill.id}`}
                                      label="Separate tax and tip on this receipt"
                                      checked={usesTaxTip}
                                      onChange={(on) => setBillUseTaxTip(bill.id, on)}
                                    />
                                  </div>

                                  {usesTaxTip && (
                                    <div className="mt-4 space-y-3">
                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Field label="Subtotal" htmlFor={`subtotal-${bill.id}`} hint="Before tax & tip">
                                          <MoneyInput
                                            id={`subtotal-${bill.id}`}
                                            value={bill.subtotal}
                                            allowNegative={false}
                                            onChange={(raw) => updateBillField(bill.id, { subtotal: parseFloat(raw) || 0 })}
                                          />
                                        </Field>
                                        <Field label="Receipt total" htmlFor={`total-${bill.id}`} hint="What you actually paid">
                                          <MoneyInput
                                            id={`total-${bill.id}`}
                                            value={bill.total}
                                            allowNegative={false}
                                            onChange={(raw) => updateBillField(bill.id, { total: parseFloat(raw) || 0 })}
                                          />
                                        </Field>
                                      </div>
                                      {bill.subtotal > 0 && lines.length > 0 && Math.abs(itemsSum - bill.subtotal) > 0.02 && (
                                        <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                                          <AlertCircle className="h-3.5 w-3.5" />
                                          Items add up to {formatMoney(itemsSum)}, subtotal is {formatMoney(bill.subtotal)}
                                        </p>
                                      )}
                                      {bill.subtotal > 0 && bill.total > bill.subtotal && (
                                        <div className="flex flex-wrap items-center gap-3">
                                          <Button
                                            type="button"
                                            variant={tipTax ? 'outline' : 'soft'}
                                            size="sm"
                                            onClick={() => calculateTipTaxForBill(bill.id)}
                                          >
                                            <Sparkles />
                                            {tipTax ? 'Recalculate tax & tip' : `Apply ${formatMoney(bill.total - bill.subtotal)} tax & tip`}
                                          </Button>
                                          {tipTax && (
                                            <span className="text-xs text-gray-400">
                                              Recalculate after changing items or totals.
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {issue && (lines.length > 0 || bill.label.trim()) && (
                                  <div className="flex items-center gap-2 border-t border-amber-100 bg-amber-50/70 px-4 py-2.5 text-xs font-medium text-amber-800 sm:px-5">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    {issue}
                                  </div>
                                )}
                              </Panel>
                            )}
                          </SortableExpenseBlock>
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>

                <button
                  type="button"
                  onClick={addExpenseBill}
                  className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-gray-200 py-5 text-sm font-medium text-gray-500 transition-colors hover:border-gray-300 hover:bg-white hover:text-gray-900"
                >
                  <Plus className="h-4 w-4" />
                  Add another receipt
                </button>
              </div>
            )}

            {/* ------------------------------------------------ Step 4 */}
            {currentStep === 4 && (
              <div className="mx-auto max-w-2xl space-y-4">
                <div className="px-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Step 4</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-gray-900">
                    {isOwner ? 'Look it over, then send it' : 'Look it over'}
                  </h2>
                </div>

                <Panel className="overflow-hidden">
                  <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 sm:px-6">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                        {bills.length > 1 ? 'Shared trip' : 'Shared tab'}
                      </p>
                      <h3 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-gray-900">{title || 'Untitled'}</h3>
                      {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Total</p>
                      <Money amount={tripTotal} className="text-xl font-semibold tracking-tight text-gray-900" />
                    </div>
                  </div>

                  <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
                    <ReviewHeading title="Who owes what" onEdit={() => goToStep(2)} editLabel="Edit people" />
                    <ul className="mt-2 space-y-1">
                      {personTotals.map((p) => (
                        <li key={p.name} className="flex items-center gap-3 py-1.5">
                          <Avatar name={p.name} size="sm" />
                          <span className="flex-1 truncate text-sm font-medium text-gray-900">{p.name}</span>
                          {p.owes < -0.005 ? (
                            <span className="text-sm text-sky-600">
                              is owed <Money amount={-p.owes} className="font-semibold" />
                            </span>
                          ) : (
                            <Money amount={p.owes} className="text-sm font-semibold text-gray-900" />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="px-5 py-4 sm:px-6">
                    <ReviewHeading title={`${bills.length} ${bills.length === 1 ? 'receipt' : 'receipts'}`} onEdit={() => goToStep(3)} editLabel="Edit receipts" />
                    <ul className="mt-2 space-y-1">
                      {bills.map((b) => (
                        <li key={b.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <Receipt className="h-4 w-4 shrink-0 text-gray-300" />
                            <span className="truncate text-gray-700">{b.label || 'Untitled'}</span>
                            {billUsesTaxTip(b) && b.total > 0 && (
                              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                                receipt {formatMoney(b.total)}
                              </span>
                            )}
                          </span>
                          <Money amount={sumBillSplits(b)} className="shrink-0 font-medium text-gray-900" />
                        </li>
                      ))}
                    </ul>
                  </div>
                </Panel>

                {(() => {
                  const calculatedTotal = bills.reduce((s, b) => s + sumBillSplits(b), 0);
                  const expectedTotal = bills.reduce(
                    (s, b) => s + (billUsesTaxTip(b) ? (b.total > 0 ? b.total : 0) : sumBillSplits(b)),
                    0
                  );
                  const difference = Math.abs(calculatedTotal - expectedTotal);
                  const isValid = difference <= 0.05;
                  return isValid ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                      <p className="text-sm text-emerald-900">
                        <span className="font-semibold">Totals line up.</span> Everyone&apos;s shares add up to{' '}
                        {formatMoney(calculatedTotal)}.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <div className="text-sm text-amber-900">
                        <p className="font-semibold">Shares are off by {formatMoney(difference)}</p>
                        <p className="mt-0.5 text-amber-800/90">
                          Receipts total {formatMoney(expectedTotal)}, but everyone&apos;s shares add up to{' '}
                          {formatMoney(calculatedTotal)}. Adjust splits or receipt totals (a few cents of rounding is fine).
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {!venmoUsername && isOwner && (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <p className="text-sm text-amber-900">
                      <span className="font-semibold">No Venmo username yet.</span> Add it in{' '}
                      <Link href="/settings" className="font-semibold underline underline-offset-2">
                        Settings
                      </Link>{' '}
                      so people know where to pay.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Live summary */}
          {currentStep < STEPS.length && (
          <aside className="hidden lg:sticky lg:top-20 lg:block">
            <Panel className="overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Live total</p>
                <Money amount={tripTotal} className="mt-0.5 block text-2xl font-semibold tracking-tight text-gray-900" />
                <p className="mt-0.5 truncate text-xs text-gray-400">
                  {title || 'Untitled'} · {bills.length} {bills.length === 1 ? 'receipt' : 'receipts'}
                </p>
              </div>
              <div className="px-5 py-3">
                {personTotals.length === 0 ? (
                  <p className="py-3 text-sm text-gray-400">Each person&apos;s share shows up here as you go.</p>
                ) : (
                  <ul className="max-h-[50vh] space-y-0.5 overflow-y-auto">
                    {personTotals.map((p) => (
                      <li key={p.name} className="flex items-center gap-2.5 py-1.5">
                        <Avatar name={p.name} size="xs" />
                        <span className="flex-1 truncate text-sm text-gray-700">{p.name}</span>
                        <Money amount={p.owes} className="text-sm font-medium text-gray-900" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>
          </aside>
          )}
        </div>
      </main>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" onClick={prevStep} disabled={currentStep === 1} className="shrink-0">
            <ArrowLeft />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <p className="min-w-0 flex-1 truncate text-center text-xs text-gray-500 sm:text-sm">
            {reason ? (
              <span className="inline-flex items-center gap-1.5 text-amber-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{reason}</span>
              </span>
            ) : currentStep < STEPS.length ? (
              <span className="hidden sm:inline">Step {currentStep} of {STEPS.length}</span>
            ) : (
              <span className="tabular-nums">
                {people.length} {people.length === 1 ? 'person' : 'people'} · {formatMoney(tripTotal)}
              </span>
            )}
          </p>
          {currentStep < STEPS.length ? (
            <Button onClick={nextStep} disabled={!canProceedToNextStep()} className="shrink-0">
              Continue
              <ArrowRight />
            </Button>
          ) : isOwner ? (
            <Button
              variant="brand"
              onClick={onSubmit}
              disabled={submitting || !title || !venmoUsername || people.length === 0 || !billsReady()}
              className="shrink-0"
            >
              {submitting ? <Spinner className="h-4 w-4 border-[1.5px] border-white/40 border-t-white" /> : <Check />}
              {isEditingActiveTab ? 'Save changes' : 'Create & get link'}
            </Button>
          ) : (
            <Button onClick={() => draftId && router.push(`/tab/${draftId}`)} disabled={!draftId} className="shrink-0">
              Done, view tab
              <ArrowRight />
            </Button>
          )}
        </div>
      </div>

      {/* Invite / share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <span className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Link2 className="h-5 w-5" />
            </span>
            <DialogTitle>Invite collaborators</DialogTitle>
            <DialogDescription>
              Anyone with this link can join this draft and add the people and expenses they covered. They can edit it,
              just like you.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-1.5 pl-3.5">
            <input
              readOnly
              value={shareUrl}
              aria-label="Invite link"
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button size="sm" onClick={handleCopyInvite} className="shrink-0">
              {copiedInvite ? <Check /> : <Copy />}
              {copiedInvite ? 'Copied' : 'Copy'}
            </Button>
          </div>
          {typeof navigator !== 'undefined' && 'share' in navigator && shareUrl && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.share({ title: title || 'TabWrapped', url: shareUrl });
                } catch {
                  /* dismissed */
                }
              }}
            >
              <Share2 />
              Share…
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / edit item dialog */}
      <Dialog
        open={isAddItemOpen}
        onOpenChange={(open) => {
          if (!open) closeItemDialog();
          else setIsAddItemOpen(true);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingItem !== null ? 'Edit item' : 'Add an item'}</DialogTitle>
            <DialogDescription>
              {(() => {
                const b = bills.find((x) => x.id === (editingItem?.billId ?? itemTargetBillId));
                const where = b?.label.trim() ? `On ${b.label.trim()}. ` : '';
                return `${where}Use a negative amount for a credit or discount.${b && billUsesTaxTip(b) ? ' Enter it before tax & tip.' : ''}`;
              })()}
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              handleAddItem();
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <Field label="Item" htmlFor="item-name">
                <input
                  id="item-name"
                  type="text"
                  placeholder="e.g. Galbi, Uber, Airbnb"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className={inputClass}
                  autoFocus
                  autoComplete="off"
                />
              </Field>
              <Field label="Amount" htmlFor="item-amount">
                <MoneyInput
                  id="item-amount"
                  value={newItem.totalAmount}
                  onChange={(raw) => {
                    const value = parseFloat(raw);
                    const nextAmount = raw === '' || Number.isNaN(value) ? 0 : value;
                    if (selectedPeople.length > 0 && raw !== '' && !Number.isNaN(value)) {
                      const ordered = orderSplitNamesFromPeople(people, selectedPeople);
                      const newSplits = buildEqualSplits(ordered, nextAmount);
                      setNewItem((prev) => ({ ...prev, totalAmount: nextAmount, customSplits: newSplits }));
                    } else {
                      setNewItem((prev) => ({ ...prev, totalAmount: nextAmount }));
                    }
                  }}
                />
              </Field>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-900">
                  Split between{' '}
                  <span className="font-normal text-gray-400">
                    {selectedPeople.length} of {people.length}
                  </span>
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={splitEvenly}
                    disabled={selectedPeople.length === 0 || newItem.totalAmount === 0}
                  >
                    Split evenly
                  </Button>
                  {selectedPeople.length === people.length ? (
                    <Button type="button" variant="ghost" size="sm" onClick={clearPeopleForLineItem} disabled={people.length === 0}>
                      Clear
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" size="sm" onClick={selectAllPeopleForLineItem} disabled={people.length === 0}>
                      Everyone
                    </Button>
                  )}
                </div>
              </div>
              <LineItemSplitList
                people={people}
                selectedPeople={selectedPeople}
                customSplits={newItem.customSplits}
                totalAmount={newItem.totalAmount}
                onToggle={togglePersonInSplit}
                onSplitAmountChange={(name, value) => {
                  setNewItem((prev) => ({
                    ...prev,
                    customSplits: new Map(prev.customSplits).set(name, value),
                  }));
                }}
              />
            </div>

            <Field
              label="Paid by"
              htmlFor="item-paidby"
              optional
              hint={
                newItem.totalAmount < 0
                  ? 'Credits can’t have a payer.'
                  : (() => {
                      const b = bills.find((x) => x.id === (editingItem?.billId ?? itemTargetBillId));
                      return b?.paidBy
                        ? `Leave as is to use this receipt's payer (${b.paidBy}). The payer is credited the full item amount.`
                        : 'Only if someone covered this item themselves. They’re credited the full amount.';
                    })()
              }
            >
              <select
                id="item-paidby"
                value={newItem.paidBy}
                disabled={newItem.totalAmount < 0}
                onChange={(e) => setNewItem({ ...newItem, paidBy: e.target.value })}
                className={cn(inputClass, 'cursor-pointer')}
              >
                <option value="">
                  {(() => {
                    const b = bills.find((x) => x.id === (editingItem?.billId ?? itemTargetBillId));
                    return b?.paidBy ? `Same as receipt (${b.paidBy})` : 'No one in particular';
                  })()}
                </option>
                {people.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <DialogFooter className="pt-1">
              <Button type="button" variant="outline" onClick={closeItemDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !newItem.name.trim() ||
                  newItem.totalAmount === 0 ||
                  Number.isNaN(newItem.totalAmount) ||
                  selectedPeople.length === 0
                }
              >
                {editingItem !== null ? 'Save item' : 'Add item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

/* ------------------------------------------------------------- pieces */

function StepTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-gray-900">{title}</h2>
      {sub && <p className="mt-1 text-sm leading-relaxed text-gray-500">{sub}</p>}
    </div>
  );
}

function ReviewHeading({ title, onEdit, editLabel }: { title: string; onEdit: () => void; editLabel: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{title}</p>
      <button
        type="button"
        onClick={onEdit}
        className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800"
        aria-label={editLabel}
      >
        Edit
      </button>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  danger,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors [&_svg]:h-4 [&_svg]:w-4',
        danger ? 'hover:bg-red-50 hover:text-red-500' : 'hover:bg-gray-100 hover:text-gray-900',
        className
      )}
    >
      {children}
    </button>
  );
}

function SaveIndicator({
  state,
  active,
  hasDoc,
}: {
  state: 'idle' | 'saving' | 'saved' | 'error';
  active: boolean;
  hasDoc: boolean;
}) {
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
        <AlertCircle className="h-3.5 w-3.5" />
        Couldn&apos;t save. Check your connection
      </span>
    );
  }
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
        <Spinner className="h-3 w-3 border-[1.5px]" />
        Saving…
      </span>
    );
  }
  if (state === 'saved' || hasDoc) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
        {active ? 'Changes saved' : 'Draft saved'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
      Saves as you go
    </span>
  );
}

export default function CreateTab() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen tw-app-bg">
          <Navbar />
          <main className="flex min-h-[60vh] items-center justify-center">
            <Spinner className="h-8 w-8" />
          </main>
        </div>
      }
    >
      <CreateTabContent />
    </Suspense>
  );
}
