'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';

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
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  
  // Form states for adding new entries
  const [newPerson, setNewPerson] = useState({ name: '', phoneNumber: '' });
  const [newItem, setNewItem] = useState({ name: '', totalAmount: 0 });
  const [selectedPeople, setSelectedPeople] = useState<SelectedPerson[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [subtotal, setSubtotal] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);

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
    }
  };

  const handlePersonSelection = (personName: string) => {
    setSelectedPeople(selectedPeople.map(person => 
      person.name === personName 
        ? { ...person, isSelected: !person.isSelected }
        : person
    ));
  };

  const handleAddItem = () => {
    if (newItem.name && newItem.totalAmount > 0) {
      const selectedCount = selectedPeople.filter(p => p.isSelected).length;
      if (selectedCount === 0) return;

      const splitAmount = newItem.totalAmount / selectedCount;
      const splits = selectedPeople
        .filter(p => p.isSelected)
        .map(p => ({
          personName: p.name,
          amount: Number(splitAmount.toFixed(2))
        }));

      if (editingItemIndex !== null) {
        // Update existing item
        const updatedItems = [...items];
        updatedItems[editingItemIndex] = { ...newItem, splits };
        setItems(updatedItems);
        setEditingItemIndex(null);
      } else {
        // Add new item
        setItems([...items, { ...newItem, splits }]);
      }

      setNewItem({ name: '', totalAmount: 0 });
      setSelectedPeople(selectedPeople.map(p => ({ ...p, isSelected: false })));
    }
  };

  const handleDeleteItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleEditItem = (index: number) => {
    const item = items[index];
    setNewItem({
      name: item.name,
      totalAmount: item.totalAmount
    });
    // Set selected people based on splits
    setSelectedPeople(selectedPeople.map(person => ({
      ...person,
      isSelected: item.splits.some(split => split.personName === person.name)
    })));
    setEditingItemIndex(index);
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
        people,
        items,
        createdAt: new Date(),
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
          </div>

          {/* People Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Add People</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Name"
                  value={newPerson.name}
                  onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                  className="flex-1 rounded-md border-gray-300"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={newPerson.phoneNumber}
                  onChange={(e) => setNewPerson({ ...newPerson, phoneNumber: e.target.value })}
                  className="flex-1 rounded-md border-gray-300"
                />
                <button
                  type="button"
                  onClick={handleAddPerson}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md"
                >
                  Add Person
                </button>
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
          </div>

          {/* Items Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Add Items</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Item Name"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="flex-1 rounded-md border-gray-300"
                />
                <input
                  type="number"
                  placeholder="Total Amount"
                  value={newItem.totalAmount || ''}
                  onChange={(e) => setNewItem({ ...newItem, totalAmount: parseFloat(e.target.value) })}
                  className="flex-1 rounded-md border-gray-300"
                />
              </div>

              {/* Split amounts */}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {people.map((person, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handlePersonSelection(person.name)}
                      className={`px-3 py-1 rounded-full ${
                        selectedPeople.find(p => p.name === person.name)?.isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {person.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md"
              >
                {editingItemIndex !== null ? 'Update Item' : 'Add Item'}
              </button>

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
      </main>
    </div>
  );
} 