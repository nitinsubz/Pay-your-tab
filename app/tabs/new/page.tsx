'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';

interface Person {
  name: string;
  phoneNumber: string;
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

// Add new interface for selected people
interface SelectedPerson {
  name: string;
  isSelected: boolean;
}

export default function CreateTab() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venmoUsername, setVenmoUsername] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  
  // Form states for adding new entries
  const [newPerson, setNewPerson] = useState({ name: '', phoneNumber: '' });
  const [newItem, setNewItem] = useState({ 
    name: '', 
    totalAmount: 0,
    customSplits: new Map<string, number>()
  });
  const [selectedPeople, setSelectedPeople] = useState<SelectedPerson[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [subtotal, setSubtotal] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.push('/login');
    });
    return () => unsubscribe();
  }, [router]);

  const handleAddPerson = () => {
    if (newPerson.name && newPerson.phoneNumber) {
      setPeople([...people, newPerson]);
      setSelectedPeople([...selectedPeople, { name: newPerson.name, isSelected: false }]);
      setNewPerson({ name: '', phoneNumber: '' });
      setIsAddPersonOpen(false);
    }
  };

  const handlePersonSelection = (personName: string) => {
    setSelectedPeople(selectedPeople.map(person => {
      if (person.name === personName) {
        const isNewSelection = !person.isSelected;
        
        // Calculate new selected count
        const currentSelected = selectedPeople.filter(p => 
          p.name === personName ? isNewSelection : p.isSelected
        ).length;
        
        // Update splits for all selected people
        if (currentSelected > 0) {
          const splitAmount = newItem.totalAmount / currentSelected;
          const newSplits = new Map(newItem.customSplits);
          
          selectedPeople.forEach(p => {
            if ((p.name === personName && isNewSelection) || (p.name !== personName && p.isSelected)) {
              newSplits.set(p.name, splitAmount);
            } else {
              newSplits.delete(p.name);
            }
          });
          
          setNewItem(prev => ({ ...prev, customSplits: newSplits }));
        }
        
        return { ...person, isSelected: isNewSelection };
      }
      return person;
    }));
  };

  const handleAddItem = () => {
    if (newItem.name && newItem.totalAmount > 0) {
      const selectedCount = selectedPeople.filter(p => p.isSelected).length;
      if (selectedCount === 0) return;

      const splits = Array.from(newItem.customSplits.entries()).map(([personName, amount]) => ({
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
      setSelectedPeople(selectedPeople.map(p => ({ ...p, isSelected: false })));
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
    setSelectedPeople(selectedPeople.map(person => ({
      ...person,
      isSelected: item.splits.some(split => split.personName === person.name)
    })));
    setEditingItemIndex(index);
    setIsAddItemOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        createdAt: serverTimestamp(),
        status: 'active'
      };

      const docRef = await addDoc(collection(db, 'tabs'), tabData);
      router.push(`/tab/${docRef.id}`);
    } catch (error) {
      console.error('Error creating tab:', error);
    }
  };

  const calculateFinalAmounts = () => {
    if (subtotal <= 0 || total <= 0) return;

    const multiplier = total / subtotal;
    
    // Create a map to store each person's share of tip/tax
    const personTotals = new Map<string, number>();
    
    // Calculate base amounts for each person
    items.forEach(item => {
      item.splits.forEach(split => {
        const currentTotal = personTotals.get(split.personName) || 0;
        personTotals.set(split.personName, currentTotal + split.amount);
      });
    });

    // Calculate and add tip/tax for each person
    const tipTaxItem: Item = {
      name: 'Tip & Tax',
      totalAmount: total - subtotal,
      splits: Array.from(personTotals.entries()).map(([name, amount]) => ({
        personName: name,
        amount: Number((amount * (multiplier - 1)).toFixed(2))
      }))
    };

    setItems([...items, tipTaxItem]);
    
    // Reset subtotal and total after calculating
    setSubtotal(0);
    setTotal(0);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8 pt-20">
        <h1 className="text-3xl font-bold mb-8">Create New Tab</h1>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Tab Info */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Tab Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Your Venmo Username</label>
              <input
                type="text"
                value={venmoUsername}
                onChange={(e) => setVenmoUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
                placeholder="@username"
              />
            </div>
          </div>

          {/* People Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">People</h2>
              <Button onClick={() => setIsAddPersonOpen(true)}>
                Add Person
              </Button>
            </div>
            
            {/* Display added people */}
            <ul className="divide-y divide-gray-200">
              {people.map((person, index) => (
                <li key={index} className="py-2 flex justify-between">
                  <span>{person.name}</span>
                  <span>{person.phoneNumber}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Items Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Items</h2>
              <Button 
                onClick={() => setIsAddItemOpen(true)} 
                disabled={people.length === 0}
                title={people.length === 0 ? "Add at least one person first" : ""}
              >
                Add Item
              </Button>
            </div>

            {/* Display added items */}
            <ul className="divide-y divide-gray-200">
              {items.map((item, index) => (
                <li key={index} className="py-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{item.name} - ${item.totalAmount}</div>
                      <div className="text-sm text-gray-500">
                        {item.splits.map((split, splitIndex) => (
                          <div key={splitIndex}>
                            {split.personName}: ${split.amount}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEditItem(index)}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Add Tip & Tax Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Add Tip & Tax</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">Subtotal</label>
                  <input
                    type="number"
                    value={subtotal || ''}
                    onChange={(e) => setSubtotal(parseFloat(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300"
                    placeholder="Enter subtotal before tip/tax"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">Total</label>
                  <input
                    type="number"
                    value={total || ''}
                    onChange={(e) => setTotal(parseFloat(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300"
                    placeholder="Enter final total with tip/tax"
                  />
                </div>
              </div>
              
              <button
                type="button"
                onClick={calculateFinalAmounts}
                disabled={!subtotal || !total || total <= subtotal}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400"
              >
                Calculate Tip & Tax Split
              </button>
              
              {total && subtotal && total <= subtotal && (
                <p className="text-red-500 text-sm">Total must be greater than subtotal</p>
              )}
              
              {total && subtotal && total > subtotal && (
                <div className="text-sm text-gray-600">
                  <p>Tip & Tax Amount: ${(total - subtotal).toFixed(2)}</p>
                  <p>Percentage: {((total / subtotal - 1) * 100).toFixed(1)}%</p>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Create Tab
          </button>
        </form>

        {/* Move Dialog outside the main form */}
        <Dialog open={isAddPersonOpen} onOpenChange={setIsAddPersonOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Person</DialogTitle>
              <DialogDescription>
                Add a new person to split the bill with.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  placeholder="Name"
                  value={newPerson.name}
                  onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                  className="w-full rounded-md border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={newPerson.phoneNumber}
                  onChange={(e) => setNewPerson({ ...newPerson, phoneNumber: e.target.value })}
                  className="w-full rounded-md border-gray-300"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddPersonOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleAddPerson}>
                Add Person
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItemIndex !== null ? 'Edit Item' : 'Add Item'}</DialogTitle>
              <DialogDescription>
                {editingItemIndex !== null ? 'Edit existing item details.' : 'Add a new item to the tab.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Item Name</label>
                <input
                  type="text"
                  placeholder="Item Name"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full rounded-md border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  placeholder="Total Amount"
                  value={newItem.totalAmount || ''}
                  onChange={(e) => setNewItem({ ...newItem, totalAmount: parseFloat(e.target.value) })}
                  className="w-full rounded-md border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Split Between</label>
                <div className="space-y-2">
                  {people.map((person, index) => {
                    const isSelected = selectedPeople.find(p => p.name === person.name)?.isSelected;
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePersonSelection(person.name)}
                          className={`px-3 py-1 rounded-full ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {person.name}
                        </button>
                        {isSelected && (
                          <input
                            type="number"
                            value={newItem.customSplits.get(person.name) || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              setNewItem(prev => ({
                                ...prev,
                                customSplits: new Map(prev.customSplits).set(person.name, value)
                              }));
                            }}
                            className="w-24 rounded-md border-gray-300"
                            placeholder="Amount"
                            step="0.01"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsAddItemOpen(false);
                setNewItem({ name: '', totalAmount: 0, customSplits: new Map() });
                setSelectedPeople(selectedPeople.map(p => ({ ...p, isSelected: false })));
                setEditingItemIndex(null);
              }}>
                Cancel
              </Button>
              <Button type="button" onClick={handleAddItem}>
                {editingItemIndex !== null ? 'Update Item' : 'Add Item'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
} 