'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { auth, db } from '@/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';

interface Person {
  name: string;
}

interface ItemSplit {
  personName: string;
  amount: number;
}

interface Item {
  name: string;
  totalAmount: number;
  splits: ItemSplit[];
}

function CreateTabContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  
  // Form data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venmoUsername, setVenmoUsername] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [subtotal, setSubtotal] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  
  // Form states for adding new entries
  const [newPersonName, setNewPersonName] = useState('');
  const [savedPeople, setSavedPeople] = useState<string[]>([]); // People saved in user profile
  const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);
  const [newItem, setNewItem] = useState({ 
    name: '', 
    totalAmount: 0,
    customSplits: new Map<string, number>()
  });
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  
  // Draft management
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialLoadRef = useRef(false);

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
        
        // Load draft if draftId is in URL
        const draftIdParam = searchParams.get('draftId');
        if (draftIdParam) {
          const draftRef = doc(db, 'tabs', draftIdParam);
          const draftSnap = await getDoc(draftRef);
          
          if (draftSnap.exists()) {
            const draftData = draftSnap.data();
            if (draftData.status === 'draft' && draftData.userId === user.uid) {
              setDraftId(draftIdParam);
              setTitle(draftData.title || '');
              setDescription(draftData.description || '');
              // Use draft venmo if exists, otherwise use profile venmo
              setVenmoUsername(draftData.venmoUsername || userSnap.data()?.venmoUsername || '');
              setPeople((draftData.people || []).map((p: { name: string }) => ({ name: p.name })));
              setItems(draftData.items || []);
              setSubtotal(draftData.subtotal || 0);
              setTotal(draftData.total || 0);
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

    if (!title && !description && !venmoUsername && people.length === 0 && items.length === 0) {
      return;
    }

    try {
      const draftData = {
        userId: user.uid,
        title,
        description,
        venmoUsername,
        people,
        items,
        subtotal,
        total,
        status: 'draft',
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
  }, [title, description, venmoUsername, people, items, subtotal, total, draftId]);

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
  }, [title, description, venmoUsername, people, items, subtotal, total, autoSave, isLoadingDraft]);

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

  const handlePersonSelection = (personName: string) => {
    if (selectedPeople.includes(personName)) {
      setSelectedPeople(selectedPeople.filter(p => p !== personName));
      const newSplits = new Map(newItem.customSplits);
      newSplits.delete(personName);
      setNewItem(prev => ({ ...prev, customSplits: newSplits }));
    } else {
      setSelectedPeople([...selectedPeople, personName]);
      const selectedCount = selectedPeople.length + 1;
      const splitAmount = newItem.totalAmount / selectedCount;
      const newSplits = new Map(newItem.customSplits);
      selectedPeople.forEach(p => {
        if (newSplits.has(p)) {
          newSplits.set(p, splitAmount);
        }
      });
      newSplits.set(personName, splitAmount);
      setNewItem(prev => ({ ...prev, customSplits: newSplits }));
    }
  };

  const handleAddItem = () => {
    if (newItem.name && newItem.totalAmount > 0 && selectedPeople.length > 0) {
      const splits = Array.from(newItem.customSplits.entries())
        .filter(([name]) => selectedPeople.includes(name))
        .map(([personName, amount]) => ({
          personName,
          amount: Number(amount.toFixed(2))
        }));

      if (editingItemIndex !== null) {
        const updatedItems = [...items];
        updatedItems[editingItemIndex] = {
          name: newItem.name,
          totalAmount: newItem.totalAmount,
          splits
        };
        setItems(updatedItems);
        setEditingItemIndex(null);
      } else {
        setItems([...items, {
          name: newItem.name,
          totalAmount: newItem.totalAmount,
          splits
        }]);
      }

      setNewItem({ name: '', totalAmount: 0, customSplits: new Map() });
      setSelectedPeople([]);
      setIsAddItemOpen(false);
    }
  };

  const handleDeleteItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleEditItem = (index: number) => {
    const item = items[index];
    const customSplits = new Map(item.splits.map(split => [split.personName, split.amount]));
    setNewItem({
      name: item.name,
      totalAmount: item.totalAmount,
      customSplits
    });
    setSelectedPeople(item.splits.map(split => split.personName));
    setEditingItemIndex(index);
    setIsAddItemOpen(true);
  };

  const calculateTipTax = () => {
    if (subtotal > 0 && total > 0 && total > subtotal) {
      const multiplier = total / subtotal;
      
      // Calculate tip/tax item
      const personTotals = new Map<string, number>();
      
      items.forEach(item => {
        item.splits.forEach(split => {
          const currentTotal = personTotals.get(split.personName) || 0;
          personTotals.set(split.personName, currentTotal + split.amount);
        });
      });

      const tipTaxItem: Item = {
        name: 'Tip & Tax',
        totalAmount: total - subtotal,
        splits: Array.from(personTotals.entries()).map(([name, amount]) => ({
          personName: name,
          amount: Number((amount * (multiplier - 1)).toFixed(2))
        }))
      };

      // Remove existing tip/tax item if it exists
      const filteredItems = items.filter(item => item.name !== 'Tip & Tax');
      setItems([...filteredItems, tipTaxItem]);
    }
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
        people,
        items,
        status: 'active',
        updatedAt: serverTimestamp()
      };

      if (draftId) {
        const draftRef = doc(db, 'tabs', draftId);
        await updateDoc(draftRef, {
          ...tabData,
          createdAt: serverTimestamp()
        });
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

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        return title.trim() !== '';
      case 2:
        return people.length > 0;
      case 3:
        return items.length > 0;
      case 4:
        return subtotal > 0 && total > 0 && total > subtotal;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (currentStep === 4) {
      calculateTipTax();
    }
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
    if (step >= 1 && step <= totalSteps) {
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

  // Step indicator
  const steps = [
    { number: 1, title: 'Metadata' },
    { number: 2, title: 'People' },
    { number: 3, title: 'Items' },
    { number: 4, title: 'Tax & Tip' },
    { number: 5, title: 'Review' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8 pt-20 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Create New Tab</h1>
          {draftId && (
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              Draft saved automatically
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
              <h2 className="text-2xl font-semibold mb-6">Tab Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tab Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="e.g., Dinner at Restaurant"
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

          {/* Step 3: Items */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-semibold">Add Items</h2>
                  <p className="text-sm text-gray-500 mt-1">Note: Do not include tax and tip in item amounts</p>
                </div>
                <Button 
                  onClick={() => setIsAddItemOpen(true)} 
                  disabled={people.length === 0}
                >
                  Add Item
                </Button>
              </div>
              {items.filter(item => item.name !== 'Tip & Tax').length === 0 ? (
                <p className="text-gray-500 text-center py-8">No items added yet. Click &quot;Add Item&quot; to get started.</p>
              ) : (
                <ul className="space-y-4">
                  {items.filter(item => item.name !== 'Tip & Tax').map((item, index) => (
                    <li key={index} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-lg">{item.name}</div>
                          <div className="text-indigo-600 font-semibold mt-1">${item.totalAmount.toFixed(2)}</div>
                          <div className="mt-2 text-sm text-gray-600">
                            <div className="font-medium mb-1">Split between:</div>
                            {item.splits.map((split, splitIndex) => (
                              <div key={splitIndex} className="ml-4">
                                {split.personName}: ${split.amount.toFixed(2)}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditItem(index)}
                            className="text-indigo-600 hover:text-indigo-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteItem(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Step 4: Tax & Tip */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Calculate Tax & Tip</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subtotal (before tax & tip)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={subtotal || ''}
                      onChange={(e) => setSubtotal(parseFloat(e.target.value))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Final Total (with tax & tip)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={total || ''}
                      onChange={(e) => setTotal(parseFloat(e.target.value))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {subtotal > 0 && total > 0 && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    {total <= subtotal ? (
                      <p className="text-red-600 text-sm">Total must be greater than subtotal</p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Tax & Tip Amount:</span> ${(total - subtotal).toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Multiplier:</span> {(total / subtotal).toFixed(4)}x ({(total / subtotal - 1) * 100}%)
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Review & Submit</h2>
              
              {/* Metadata Review */}
              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-2">Tab Information</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Title:</span> {title}</p>
                  {description && <p><span className="font-medium">Description:</span> {description}</p>}
                  {venmoUsername && <p><span className="font-medium">Venmo:</span> {venmoUsername}</p>}
                  {!venmoUsername && (
                    <p className="text-yellow-600">
                      <span className="font-medium">Venmo:</span> Not set. Please set it in{' '}
                      <button
                        onClick={() => router.push('/settings')}
                        className="underline"
                      >
                        Settings
                      </button>
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => goToStep(1)}>
                  Edit
                </Button>
              </div>

              {/* People Review */}
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

              {/* Items Review */}
              <div className="border-b pb-4">
                <h3 className="font-semibold text-lg mb-2">Items ({items.filter(item => item.name !== 'Tip & Tax').length})</h3>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="text-sm">
                      <span className="font-medium">{item.name}:</span> ${item.totalAmount.toFixed(2)}
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => goToStep(3)}>
                  Edit
                </Button>
              </div>

              {/* Tax & Tip Review */}
              {subtotal > 0 && total > 0 && (
                <div className="border-b pb-4">
                  <h3 className="font-semibold text-lg mb-2">Tax & Tip</h3>
                  <div className="text-sm space-y-1">
                    <p><span className="font-medium">Subtotal:</span> ${subtotal.toFixed(2)}</p>
                    <p><span className="font-medium">Total:</span> ${total.toFixed(2)}</p>
                    <p><span className="font-medium">Tax & Tip:</span> ${(total - subtotal).toFixed(2)}</p>
                  </div>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => goToStep(4)}>
                    Edit
                  </Button>
                </div>
              )}

              {/* Summary */}
              <div className="bg-indigo-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">Summary</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Total People:</span> {people.length}</p>
                  <p><span className="font-medium">Total Items:</span> {items.filter(item => item.name !== 'Tip & Tax').length}</p>
                  {total > 0 && <p><span className="font-medium">Final Total:</span> ${total.toFixed(2)}</p>}
                </div>
              </div>

              {/* Validation Check */}
              {(() => {
                // Calculate total from all splits
                const personTotals = new Map<string, number>();
                items.forEach(item => {
                  item.splits.forEach(split => {
                    const currentTotal = personTotals.get(split.personName) || 0;
                    personTotals.set(split.personName, currentTotal + split.amount);
                  });
                });
                
                const calculatedTotal = Array.from(personTotals.values()).reduce((sum, amount) => sum + amount, 0);
                const difference = Math.abs(calculatedTotal - total);
                const tolerance = 0.01; // Allow 1 cent difference for rounding
                const isValid = total > 0 && difference <= tolerance;
                
                return (
                  <div className={`p-4 rounded-lg border-2 ${
                    isValid 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      {isValid ? (
                        <>
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-green-800">Amounts Match ✓</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-red-800">Amount Mismatch ⚠️</span>
                        </>
                      )}
                    </h3>
                    <div className="space-y-1 text-sm">
                      <p className={isValid ? 'text-green-700' : 'text-red-700'}>
                        <span className="font-medium">Expected Total:</span> ${total.toFixed(2)}
                      </p>
                      <p className={isValid ? 'text-green-700' : 'text-red-700'}>
                        <span className="font-medium">Calculated from Splits:</span> ${calculatedTotal.toFixed(2)}
                      </p>
                      {!isValid && (
                        <p className="text-red-700 font-medium">
                          Difference: ${difference.toFixed(2)} - Please adjust item splits to match the total
                        </p>
                      )}
                      {isValid && (
                        <div className="mt-2 pt-2 border-t border-green-200">
                          <p className="text-sm text-green-700 font-medium">Breakdown by Person:</p>
                          <div className="mt-1 space-y-1">
                            {Array.from(personTotals.entries()).map(([name, amount]) => (
                              <p key={name} className="text-xs text-green-600 ml-4">
                                {name}: ${amount.toFixed(2)}
                              </p>
                            ))}
                          </div>
                        </div>
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
                disabled={!title || !venmoUsername || people.length === 0 || items.filter(item => item.name !== 'Tip & Tax').length === 0}
              >
                {!venmoUsername ? 'Set Venmo Username First' : 'Create Tab'}
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
        <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItemIndex !== null ? 'Edit Item' : 'Add Item'}</DialogTitle>
              <DialogDescription>
                {editingItemIndex !== null ? 'Edit existing item details.' : 'Add a new item to the tab. Do not include tax and tip.'}
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
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newItem.totalAmount || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setNewItem({ ...newItem, totalAmount: value || 0 });
                    // Recalculate splits when amount changes
                    if (selectedPeople.length > 0 && value > 0) {
                      const splitAmount = value / selectedPeople.length;
                      const newSplits = new Map();
                      selectedPeople.forEach(person => {
                        newSplits.set(person, splitAmount);
                      });
                      setNewItem(prev => ({ ...prev, customSplits: newSplits }));
                    }
                  }}
                  className="w-full rounded-md border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Split Between</label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {people.map((person, index) => {
                    const isSelected = selectedPeople.includes(person.name);
                    const splitAmount = newItem.customSplits.get(person.name) || 0;
                    return (
                      <div key={index} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                        <button
                          type="button"
                          onClick={() => handlePersonSelection(person.name)}
                          className={`px-4 py-2 rounded-md font-medium transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {person.name}
                        </button>
                        {isSelected && (
                          <input
                            type="number"
                            step="0.01"
                            value={splitAmount || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              setNewItem(prev => ({
                                ...prev,
                                customSplits: new Map(prev.customSplits).set(person.name, value || 0)
                              }));
                            }}
                            className="w-32 rounded-md border-gray-300"
                            placeholder="Amount"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddItemOpen(false);
                setNewItem({ name: '', totalAmount: 0, customSplits: new Map() });
                setSelectedPeople([]);
                setEditingItemIndex(null);
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddItem}
                disabled={!newItem.name || !newItem.totalAmount || selectedPeople.length === 0}
              >
                {editingItemIndex !== null ? 'Update Item' : 'Add Item'}
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
