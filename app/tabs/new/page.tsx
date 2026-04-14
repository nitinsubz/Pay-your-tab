'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
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
import { GripVertical } from 'lucide-react';
import { auth, db } from '@/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { createEmptyBill, normalizeTripBill, billUsesTaxTip, sumBillSplits, type TripBill } from '@/lib/tripLedger';

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
      <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        {people.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Add people in step 2 first.</p>
        ) : (
          people.map((person, index) => {
            const isSelected = selectedPeople.includes(person.name);
            const splitAmount = customSplits.get(person.name) ?? 0;
            const id = `line-split-${index}`;
            return (
              <div
                key={person.name}
                className={`flex flex-wrap items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0 ${
                  isSelected ? 'bg-indigo-50/60' : 'bg-white'
                }`}
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggle(person.name, e.target.checked);
                  }}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-sm font-medium text-slate-900">
                  {person.name}
                </label>
                {isSelected && (
                  <input
                    type="number"
                    step="0.01"
                    value={splitAmount === 0 ? '' : splitAmount}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      onSplitAmountChange(person.name, Number.isNaN(v) ? 0 : v);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-28 shrink-0 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums"
                    placeholder="0.00"
                    aria-label={`${person.name} share`}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
      {selectedPeople.length > 0 && totalAmount !== 0 && (
        <p className={`mt-2 text-xs ${drift ? 'text-amber-700' : 'text-slate-500'}`}>
          Shares sum to ${sum.toFixed(2)}
          {drift ? ` · line total is $${totalAmount.toFixed(2)}` : ''}
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
      className={isDragging ? 'relative z-20 rounded-xl opacity-[0.97] shadow-lg ring-2 ring-indigo-300/50' : ''}
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
      className={`rounded-lg border border-slate-100 bg-white p-3 ${
        isDragging ? 'relative z-20 shadow-md ring-2 ring-indigo-200' : ''
      }`}
    >
      {children({ setActivatorNodeRef, attributes, listeners })}
    </li>
  );
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
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  
  // Draft management / existing document id (draft or active tab being edited)
  const [draftId, setDraftId] = useState<string | null>(null);
  /** True when editing a published tab — auto-save keeps status active and preserves payment state. */
  const [isEditingActiveTab, setIsEditingActiveTab] = useState(false);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
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
      const user = auth.currentUser;
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
            if (tabData.userId === user.uid && tabData.status === 'active') {
              setDraftId(editIdParam);
              setIsEditingActiveTab(true);
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
              setEditLoadError(
                tabData.userId !== user.uid
                  ? 'You can only edit your own tabs.'
                  : 'Only published tabs can be opened for editing this way.'
              );
            }
          } else {
            setEditLoadError('That tab could not be found.');
          }
        } else if (draftIdParam) {
          const draftRef = doc(db, 'tabs', draftIdParam);
          const draftSnap = await getDoc(draftRef);
          
          if (draftSnap.exists()) {
            const draftData = draftSnap.data();
            if (draftData.status === 'draft' && draftData.userId === user.uid) {
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
    const user = auth.currentUser;
    if (!user) return;

    if (!title && !description && !venmoUsername && people.length === 0 && bills.every(b => b.items.length === 0)) {
      return;
    }

    try {
      const draftData = {
        userId: user.uid,
        title,
        description,
        venmoUsername,
        people: stripUndefinedDeep(people),
        bills: stripUndefinedDeep(bills),
        status: isEditingActiveTab ? ('active' as const) : ('draft' as const),
        updatedAt: serverTimestamp()
      };

      if (draftId) {
        const draftRef = doc(db, 'tabs', draftId);
        await updateDoc(draftRef, draftData);
      } else {
        const newDraftData = {
          ...draftData,
          createdAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'tabs'), newDraftData);
        setDraftId(docRef.id);
      }
    } catch (error) {
      console.error('Error auto-saving draft:', error);
    }
  }, [title, description, venmoUsername, people, bills, draftId, isEditingActiveTab]);

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

      const user = auth.currentUser;
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
      const userId = auth.currentUser?.uid;
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

  if (isLoadingDraft) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8 pt-20">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </main>
      </div>
    );
  }

  if (editLoadError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8 pt-20 max-w-lg">
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center shadow-sm">
            <p className="text-red-900">{editLoadError}</p>
            <Button className="mt-6" onClick={() => router.push('/tabs')}>
              Back to my tabs
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Step indicator
  const steps = [
    { number: 1, title: 'Trip' },
    { number: 2, title: 'People' },
    { number: 3, title: 'Expenses' },
    { number: 4, title: 'Review' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8 pt-20 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">
            {isEditingActiveTab ? 'Edit trip tab' : 'New trip tab'}
          </h1>
          {draftId && !isEditingActiveTab && (
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              Draft saved automatically
            </span>
          )}
          {isEditingActiveTab && (
            <span className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
              Editing published tab — changes save automatically
            </span>
          )}
        </div>

        {/* Step Indicator */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <button
                    onClick={() => goToStep(step.number)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                      currentStep === step.number
                        ? 'bg-indigo-600 text-white'
                        : currentStep > step.number
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {currentStep > step.number ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </button>
                  <span className={`mt-2 text-xs font-medium ${
                    currentStep === step.number ? 'text-indigo-600' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow p-8">
          {/* Step 1: Metadata */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold mb-6">Trip or event</h2>
              <p className="text-sm text-gray-600 -mt-4 mb-4">
                One link for the whole trip. You&apos;ll add separate receipts (dinner, lunch, etc.) in the next steps.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="e.g., Weekend in Austin"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="Optional description"
                  />
                </div>
                {venmoUsername ? (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Venmo Username:</span> {venmoUsername}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      This will be used for this tab. You can change it in{' '}
                      <button
                        onClick={() => router.push('/settings')}
                        className="text-indigo-600 hover:text-indigo-800 underline"
                      >
                        Settings
                      </button>
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 mb-2">
                      <span className="font-medium">No Venmo username set.</span> Please set your Venmo username in{' '}
                      <button
                        onClick={() => router.push('/settings')}
                        className="text-indigo-600 hover:text-indigo-800 underline font-medium"
                      >
                        Settings
                      </button>
                      {' '}before creating a tab.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: People */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Add People</h2>
                <Button onClick={() => setIsAddPersonOpen(true)}>
                  Add Person
                </Button>
              </div>
              {people.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No people added yet. Click &quot;Add Person&quot; to get started.</p>
              ) : (
                <ul className="space-y-3">
                  {people.map((person, index) => (
                    <li key={index} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                      <span className="font-medium">{person.name}</span>
                      <button
                        onClick={() => handleDeletePerson(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Step 3: Multiple expenses (receipts) */}
          {currentStep === 3 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold">Add each receipt</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Add each receipt. Turn on tax &amp; tip only for restaurant-style checks; leave it off for gas, groceries, or anything where your line splits are the full amounts.
                </p>
                <p className="text-sm text-indigo-700/90 mt-2">
                  <span className="font-medium">Reorder:</span> drag the handle next to an expense — top to bottom is the order on the shared tab.
                </p>
              </div>

              <DndContext sensors={billSensors} collisionDetection={closestCenter} onDragEnd={handleBillsDragEnd}>
                <SortableContext items={bills.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-8">
                  {bills.map((bill, billIdx) => (
                    <SortableExpenseBlock key={bill.id} id={bill.id}>
                      {(drag) => (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                            <div className="flex min-w-0 flex-1 items-start gap-2">
                              <button
                                type="button"
                                className="mt-0.5 shrink-0 cursor-grab touch-manipulation rounded p-1 text-slate-400 hover:bg-slate-200/80 hover:text-slate-600 active:cursor-grabbing"
                                ref={drag.setActivatorNodeRef}
                                aria-label="Drag to reorder expenses"
                                title="Drag to reorder"
                                {...drag.attributes}
                                {...drag.listeners}
                              >
                                <GripVertical className="h-5 w-5" aria-hidden />
                              </button>
                              <div className="min-w-0 flex-1">
                                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                                  Expense {billIdx + 1}
                                </label>
                                <input
                                  type="text"
                                  value={bill.label}
                                  onChange={(e) => updateBillField(bill.id, { label: e.target.value })}
                                  placeholder='e.g. Dinner at Luigi&apos;s'
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
                                />
                              </div>
                            </div>
                            {bills.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeExpenseBill(bill.id)}
                                className="text-sm text-red-600 hover:text-red-800"
                              >
                                Remove expense
                              </button>
                            )}
                          </div>

                  {people.length > 0 && (
                    <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/80 p-4">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Entire expense paid by (optional)
                      </label>
                      <p className="text-xs text-slate-600 mb-2">
                        Pick one person if they covered this whole receipt — it applies to every line item and to tax
                        &amp; tip when you apply it. Set &quot;Paid by&quot; on a single line only when that line is
                        different.
                      </p>
                      <select
                        value={bill.paidBy ?? ''}
                        onChange={(e) =>
                          updateBillField(bill.id, { paidBy: e.target.value ? e.target.value : undefined })
                        }
                        className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">— Split only (no default payer) —</option>
                        {people.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                    <p className="text-sm text-slate-600">
                      {billUsesTaxTip(bill)
                        ? 'Line items (amounts before tax & tip)'
                        : 'Line items (full amounts — splits should match what each person owes)'}
                    </p>
                    <Button type="button" onClick={() => openAddItem(bill.id)} disabled={people.length === 0} size="sm">
                      Add line item
                    </Button>
                  </div>

                  {bill.items.filter((i) => i.name !== 'Tip & Tax').length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center bg-white rounded-lg border border-dashed border-slate-200">
                      No line items yet for this expense.
                    </p>
                  ) : (
                    <DndContext
                      sensors={billSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleLineItemDragEnd(bill.id, event)}
                    >
                      <SortableContext
                        items={bill.items
                          .map((item, index) => ({ item, index }))
                          .filter(({ item }) => item.name !== 'Tip & Tax')
                          .map(({ index }) => `${bill.id}-line-${index}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="space-y-2 mb-4">
                          {bill.items
                            .map((item, index) => ({ item, index }))
                            .filter(({ item }) => item.name !== 'Tip & Tax')
                            .map(({ item, index }) => (
                          <SortableLineItemBlock key={`${bill.id}-${index}`} id={`${bill.id}-line-${index}`}>
                            {(drag) => (
                          <div className="flex justify-between gap-3">
                            <div>
                              <div className="font-medium">{item.name}</div>
                              {(item.paidBy || bill.paidBy) && (
                                <div className="text-xs text-slate-500 mt-0.5">
                                  Paid by {item.paidBy || bill.paidBy}
                                  {item.paidBy ? ' (this line)' : ' (whole expense)'}
                                </div>
                              )}
                              <div
                                className={`text-sm font-semibold ${
                                  item.totalAmount < 0 ? 'text-blue-600' : 'text-indigo-600'
                                }`}
                              >
                                {item.totalAmount < 0
                                  ? `-$${Math.abs(item.totalAmount).toFixed(2)}`
                                  : `$${item.totalAmount.toFixed(2)}`}
                                {item.totalAmount < 0 && (
                                  <span className="ml-1 text-xs font-normal text-slate-500">credit</span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0 items-start">
                              <button
                                type="button"
                                className="mt-0.5 shrink-0 cursor-grab touch-manipulation rounded p-1 text-slate-400 hover:bg-slate-200/80 hover:text-slate-600 active:cursor-grabbing"
                                ref={drag.setActivatorNodeRef}
                                aria-label="Drag to reorder line item"
                                title="Drag to reorder"
                                {...drag.attributes}
                                {...drag.listeners}
                              >
                                <GripVertical className="h-4 w-4" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditItem(bill.id, index)}
                                className="text-indigo-600 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateItem(bill.id, index)}
                                className="text-slate-600 text-sm"
                              >
                                Duplicate
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(bill.id, index)}
                                className="text-red-600 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                            )}
                          </SortableLineItemBlock>
                        ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
                  )}

                  <div className="rounded-lg border border-slate-200 bg-white p-4 mb-3">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={billUsesTaxTip(bill)}
                        onChange={(e) => setBillUseTaxTip(bill.id, e.target.checked)}
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">Separate tax &amp; tip on this receipt</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Use for restaurants: enter subtotal and the full receipt total, then apply tip/tax to splits. Skip for gas, groceries, or when line items already include everything.
                        </span>
                      </span>
                    </label>
                  </div>

                  {billUsesTaxTip(bill) && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Subtotal (before tax & tip)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={bill.subtotal || ''}
                            onChange={(e) => updateBillField(bill.id, { subtotal: parseFloat(e.target.value) || 0 })}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Receipt total (with tax & tip)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={bill.total || ''}
                            onChange={(e) => updateBillField(bill.id, { total: parseFloat(e.target.value) || 0 })}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      {bill.subtotal > 0 && bill.total > bill.subtotal && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full sm:w-auto"
                          onClick={() => calculateTipTaxForBill(bill.id)}
                        >
                          Apply tip &amp; tax to splits for this expense
                        </Button>
                      )}
                    </>
                  )}
                        </div>
                      )}
                    </SortableExpenseBlock>
                  ))}
                  </div>
                </SortableContext>
              </DndContext>

              <Button type="button" variant="outline" className="w-full border-dashed border-2 py-6" onClick={addExpenseBill}>
                + Add another expense
              </Button>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Review & submit</h2>
              
              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-2">Trip</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Name:</span> {title}</p>
                  {description && <p><span className="font-medium">Description:</span> {description}</p>}
                  {venmoUsername && <p><span className="font-medium">Venmo:</span> {venmoUsername}</p>}
                  {!venmoUsername && (
                    <p className="text-yellow-600">
                      <span className="font-medium">Venmo:</span> Not set. Please set it in{' '}
                      <button type="button" onClick={() => router.push('/settings')} className="underline">
                        Settings
                      </button>
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => goToStep(1)}>
                  Edit
                </Button>
              </div>

              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-2">People ({people.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {people.map((person, index) => (
                    <span key={index} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                      {person.name}
                    </span>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => goToStep(2)}>
                  Edit
                </Button>
              </div>

              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-2">Expenses ({bills.length})</h3>
                <ul className="space-y-2 text-sm">
                  {bills.map((b) => (
                    <li key={b.id} className="flex justify-between gap-2">
                      <span>{b.label || 'Untitled'}</span>
                      <span className="text-slate-600">
                        {billUsesTaxTip(b) && b.total > 0
                          ? `$${b.total.toFixed(2)} (receipt)`
                          : `$${sumBillSplits(b).toFixed(2)} (splits)`}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => goToStep(3)}>
                  Edit
                </Button>
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Summary</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Receipts:</span> {bills.length}</p>
                  <p>
                    <span className="font-medium">Trip total (from splits):</span>{' '}
                    $
                    {bills
                      .reduce(
                        (sum, b) =>
                          sum +
                          b.items.reduce((s, it) => s + it.splits.reduce((a, sp) => a + sp.amount, 0), 0),
                        0
                      )
                      .toFixed(2)}
                  </p>
                </div>
              </div>

              {(() => {
                const calculatedTotal = bills.reduce((s, b) => s + sumBillSplits(b), 0);
                const expectedTotal = bills.reduce(
                  (s, b) =>
                    s + (billUsesTaxTip(b) ? (b.total > 0 ? b.total : 0) : sumBillSplits(b)),
                  0
                );
                const difference = Math.abs(calculatedTotal - expectedTotal);
                const tolerance = 0.05;
                const isValid = difference <= tolerance;

                return (
                  <div
                    className={`p-4 rounded-lg border-2 ${
                      isValid ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      {isValid ? (
                        <span className="text-green-800">Totals line up ✓</span>
                      ) : (
                        <span className="text-amber-900">Check amounts</span>
                      )}
                    </h3>
                    <div className="space-y-1 text-sm">
                      <p className={isValid ? 'text-green-700' : 'text-amber-900'}>
                        <span className="font-medium">Expected (receipt totals + simple splits):</span> $
                        {expectedTotal.toFixed(2)}
                      </p>
                      <p className={isValid ? 'text-green-700' : 'text-amber-900'}>
                        <span className="font-medium">From all line-item splits:</span> ${calculatedTotal.toFixed(2)}
                      </p>
                      {!isValid && (
                        <p className="text-amber-900">
                          Difference ${difference.toFixed(2)} — adjust splits or receipt totals (rounding within a few cents is ok).
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              Previous
            </Button>
            {currentStep < totalSteps ? (
              <Button
                onClick={nextStep}
                disabled={!canProceedToNextStep()}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!title || !venmoUsername || people.length === 0 || !billsReady()}
              >
                {!venmoUsername
                  ? 'Set Venmo Username First'
                  : isEditingActiveTab
                    ? 'Save changes'
                    : 'Create trip tab'}
              </Button>
            )}
          </div>
        </div>

        {/* Add Person Dialog */}
        <Dialog open={isAddPersonOpen} onOpenChange={setIsAddPersonOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Person</DialogTitle>
              <DialogDescription>
                Select from your saved people or type a new name to add them.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type or select a name"
                    value={newPersonName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewPersonName(value);
                      if (savedPeople.length > 0) {
                        setShowPersonSuggestions(true);
                      }
                    }}
                    onFocus={() => {
                      if (savedPeople.length > 0) {
                        setShowPersonSuggestions(true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPerson();
                      } else if (e.key === 'Escape') {
                        setShowPersonSuggestions(false);
                      }
                    }}
                    onBlur={(e) => {
                      // Delay to allow clicking on suggestions
                      setTimeout(() => {
                        // Check if the blur was caused by clicking on a suggestion
                        if (!e.relatedTarget || !e.relatedTarget.closest('.suggestions-dropdown')) {
                          setShowPersonSuggestions(false);
                        }
                      }, 200);
                    }}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    autoFocus
                  />
                  {showPersonSuggestions && filteredPersonSuggestions.length > 0 && (
                    <div className="suggestions-dropdown absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredPersonSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault(); // Prevent input blur
                            handleAddPerson(suggestion);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {savedPeople.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {filteredPersonSuggestions.length > 0 ? (
                      <>
                        {filteredPersonSuggestions.length} saved {filteredPersonSuggestions.length === 1 ? 'person' : 'people'} available
                      </>
                    ) : (
                      <>
                        {savedPeople.length} saved {savedPeople.length === 1 ? 'person' : 'people'} total (all already added)
                      </>
                    )}
                  </p>
                )}
                {savedPeople.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Type a name to add them. They&apos;ll be saved for future use.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddPersonOpen(false);
                setNewPersonName('');
                setShowPersonSuggestions(false);
              }}>
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddPerson();
                }} 
                disabled={!newPersonName || !newPersonName.trim()}
              >
                Add Person
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Item Dialog */}
        <Dialog
          open={isAddItemOpen}
          onOpenChange={(open) => {
            setIsAddItemOpen(open);
            if (!open) {
              setNewItem({ name: '', totalAmount: 0, customSplits: new Map(), paidBy: '' });
              setSelectedPeople([]);
              setEditingItem(null);
              setItemTargetBillId(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem !== null ? 'Edit line item' : 'Add line item'}</DialogTitle>
              <DialogDescription>
                {editingItem !== null
                  ? 'Edit this line item. Negative amounts count as credits.'
                  : 'Add a line to this expense. Use a negative total for a credit. For tax & tip, leave amounts pre-tax unless you turned on tax & tip for this receipt.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Item Name</label>
                <input
                  type="text"
                  placeholder="e.g., Pizza, Drinks"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full rounded-md border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                <p className="text-xs text-gray-500 mb-1">Use a negative amount for a credit (reduces what someone owes).</p>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newItem.totalAmount === 0 ? '' : newItem.totalAmount}
                  onChange={(e) => {
                    const raw = e.target.value;
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
                  className="w-full rounded-md border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Paid by (optional)</label>
                <p className="text-xs text-gray-500 mb-2">
                  Overrides &quot;Entire expense paid by&quot; for this line only. Leave empty to use the expense default.
                  The payer gets credited for the full line amount; everyone else still owes their split.
                </p>
                <select
                  value={newItem.paidBy}
                  disabled={newItem.totalAmount < 0}
                  onChange={(e) => setNewItem({ ...newItem, paidBy: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm text-sm disabled:opacity-50"
                >
                  <option value="">— Split only (no payer credit) —</option>
                  {people.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-medium text-gray-700">Split between</label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={selectAllPeopleForLineItem}
                      disabled={people.length === 0}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={clearPeopleForLineItem}
                      disabled={selectedPeople.length === 0}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Check who shares this line. Amounts rebalance when you change the selection (you can still edit a share manually).
                </p>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddItemOpen(false);
                setNewItem({ name: '', totalAmount: 0, customSplits: new Map(), paidBy: '' });
                setSelectedPeople([]);
                setEditingItem(null);
                setItemTargetBillId(null);
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddItem}
                disabled={
                  !newItem.name.trim() ||
                  newItem.totalAmount === 0 ||
                  Number.isNaN(newItem.totalAmount) ||
                  selectedPeople.length === 0
                }
              >
                {editingItem !== null ? 'Update line item' : 'Add line item'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default function CreateTab() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8 pt-20">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </main>
      </div>
    }>
      <CreateTabContent />
    </Suspense>
  );
}
