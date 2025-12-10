import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Search, UserPlus, Users, Trash2, PlusCircle, RotateCcw, Download, Upload, FileSpreadsheet, Leaf, X, Check, FileText, Settings, AlertCircle, Printer, Scissors, UserCheck, AlertTriangle, ChevronLeft, Cloud, Loader2 } from 'lucide-react';

// --- 1. 請在此處填入您的 Firebase 設定 (從 Firebase Console 複製) ---
const firebaseConfig = {
  apiKey: "AIzaSyBsSr16Th9m72p8FNP__qKIWyFbW8OMvMs",
  authDomain: "seating-chart-32df9.firebaseapp.com",
  projectId: "seating-chart-32df9",
  storageBucket: "seating-chart-32df9.firebasestorage.app",
  messagingSenderId: "585826894640",
  appId: "1:585826894640:web:470fc5942453c99b12fef5"
};

// 初始化 Firebase
// 注意：如果您的環境變數還沒設定好，這行可能會報錯，請先填入上方的 config
let db;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.warn("Firebase 初始化失敗，請檢查 Config", error);
}

const DOC_ID = "main_event"; // 我們將所有資料存此單一文檔中

// 預設名單
const INITIAL_MEMBERS = [
  // 第一列
  { id: '1', name: '尤春花' }, { id: '2', name: '王秀玉' }, { id: '3', name: '王春月' }, { id: '4', name: '王秋蘭' },
  { id: '5', name: '王振榕' }, { id: '6', name: '王崑山' }, { id: '7', name: '王欽長' }, { id: '8', name: '王鳳卿' },
  { id: '9', name: '王瓊華' }, { id: '10', name: '江岱穎' }, { id: '11', name: '何方桂枝' },
  
  // 第二列
  { id: '41', name: '林中男' }, { id: '42', name: '林玉滿' }, { id: '43', name: '林秀蘭' }, { id: '44', name: '林建谷' },
  { id: '45', name: '林美玉' }, { id: '46', name: '林英治' }, { id: '47', name: '林泰堭' }, { id: '48', name: '林偉伶' },
  { id: '49', name: '林陳美惠' }, { id: '50', name: '林榮春' }, { id: '51', name: '林蔡碧梅' },

  // 第三列
  { id: '81', name: '莊秋澤' }, { id: '82', name: '莊淑珠' }, { id: '83', name: '許文憲' }, { id: '84', name: '許明晃' },
  { id: '85', name: '許麗美' }, { id: '86', name: '許麗美' }, { id: '87', name: '郭源' }, { id: '88', name: '郭福從' },
  { id: '89', name: '陳月英' }, { id: '90', name: '陳月霞' }, { id: '91', name: '陳世通' },

  // 第四列
  { id: '121', name: '黃國安' }, { id: '122', name: '黃淑亮' }, { id: '123', name: '黃淑貞' }, { id: '124', name: '黃淑萍' },
  { id: '125', name: '黃復朝' }, { id: '126', name: '黃筆忠' }, { id: '127', name: '黃董事長盈彰' }, { id: '128', name: '黃碧如' },
  { id: '129', name: '黃蔡敏' }, { id: '130', name: '黃蔡清鏡' }, { id: '131', name: '黃鄭月華' },

  // 第五列
  { id: '161', name: '盧明徳' }, { id: '162', name: '盧廖靜子' }, { id: '163', name: '蕭玉花' }, { id: '164', name: '蕭宜珊' },
  { id: '165', name: '蕭國鐘' }, { id: '166', name: '蕭筱華' }, { id: '167', name: '蕭賴金葉' }, { id: '168', name: '賴威良' },
  { id: '169', name: '賴恒岐' }, { id: '170', name: '賴淑娟' }
];

const DEFAULT_REGULAR_TABLES = 18;
const SEATS_PER_TABLE = 10;

const App = () => {
  // 狀態
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true); // 讀取狀態
  const [saving, setSaving] = useState(false);  // 儲存狀態
  
  // UI 狀態
  const [selectedMember, setSelectedMember] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [quickAddValues, setQuickAddValues] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isPrintPreviewMode, setIsPrintPreviewMode] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberId, setNewMemberId] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [rawFileContent, setRawFileContent] = useState('');
  const [parsedPreviewMembers, setParsedPreviewMembers] = useState([]);
  const [importEncoding, setImportEncoding] = useState('utf-8');

  const fileInputRef = useRef(null);
  const nameInputRef = useRef(null);

  // --- 2. 初始化與監聽 Firebase 資料 ---
  useEffect(() => {
    if (!db) {
      // 如果沒有 Firebase Config，就 fallback 到本地資料，避免白畫面
      console.log("No Firebase config, using local defaults.");
      initializeTables(true); // true = local mode
      setLoading(false);
      return;
    }

    // 監聽 Firestore 資料變化 (Real-time)
    const unsub = onSnapshot(doc(db, "seating_chart", DOC_ID), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMembers(data.members || INITIAL_MEMBERS);
        setTables(data.tables || []);
      } else {
        // 如果資料庫是空的，初始化預設值
        console.log("Creating new DB entry...");
        initializeTables(false); 
      }
      setLoading(false);
    }, (error) => {
      console.error("Firebase 讀取錯誤:", error);
      showNotification("連線錯誤，無法讀取雲端資料", "error");
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // --- 3. 儲存資料到 Firebase ---
  const saveDataToFirebase = async (newMembers, newTables) => {
    if (!db) return; // 沒有 DB 就跳過
    setSaving(true);
    try {
      await setDoc(doc(db, "seating_chart", DOC_ID), {
        members: newMembers,
        tables: newTables,
        lastUpdated: new Date()
      });
      setSaving(false);
    } catch (e) {
      console.error("儲存失敗", e);
      showNotification("儲存失敗，請檢查網路", "error");
      setSaving(false);
    }
  };

  // 初始化桌次
  const initializeTables = (isLocal = false) => {
    const newTables = [];
    for (let i = 1; i <= DEFAULT_REGULAR_TABLES; i++) {
      newTables.push({
        id: `table-${Date.now()}-${i}`,
        name: `第 ${i} 桌`,
        type: 'regular',
        seats: Array(SEATS_PER_TABLE).fill(null)
      });
    }
    newTables.push({
      id: `table-${Date.now()}-veg`,
      name: `素食桌`,
      type: 'vegetarian',
      seats: Array(SEATS_PER_TABLE).fill(null)
    });
    
    setTables(newTables);
    if (!isLocal) {
       saveDataToFirebase(members, newTables);
    }
  };

  // --- 通用更新函式 (取代原本的 setState) ---
  // 這個函式會同時更新本地 State 和 Firebase
  const updateData = (newMembers, newTables) => {
    setMembers(newMembers);
    setTables(newTables);
    saveDataToFirebase(newMembers, newTables);
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- 邏輯功能 (已修改為使用 updateData) ---

  const handleSeatClick = (tableIndex, seatIndex) => {
    const currentOccupant = tables[tableIndex].seats[seatIndex];

    if (selectedMember && !currentOccupant) {
      const isAlreadySeated = tables.some(t => t.seats.some(s => s && s.id === selectedMember.id));
      if (isAlreadySeated) {
         if (!window.confirm(`${selectedMember.name} 已經在其他座位了，確定要換到這裡嗎？`)) return;
      }
      
      // 1. 先清除該成員原本的座位
      const tablesAfterRemoval = tables.map(t => ({
        ...t,
        seats: t.seats.map(s => (s && s.id === selectedMember.id) ? null : s)
      }));
      
      // 2. 在新位置入座
      const finalTables = tablesAfterRemoval.map((t, idx) => {
        if (idx === tableIndex) {
           const newSeats = [...t.seats];
           newSeats[seatIndex] = selectedMember;
           return { ...t, seats: newSeats };
        }
        return t;
      });
      
      updateData(members, finalTables);
      setSelectedMember(null);
      showNotification(`${selectedMember.name} 入座`);
      
    } else if (currentOccupant) {
      promptDelete(tableIndex, seatIndex, currentOccupant.name);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const { tableIndex, seatIndex, memberName } = deleteTarget;

    const newTables = tables.map((table, tIdx) => {
      if (tIdx === tableIndex) {
        const newSeats = [...table.seats];
        newSeats[seatIndex] = null;
        return { ...table, seats: newSeats };
      }
      return table;
    });

    updateData(members, newTables);
    showNotification(`已移除 ${memberName}`);
    setDeleteTarget(null);
  };

  const performReset = () => {
    // 重新產生初始狀態
    const newTables = [];
    for (let i = 1; i <= DEFAULT_REGULAR_TABLES; i++) {
      newTables.push({
        id: `table-${Date.now()}-${i}`,
        name: `第 ${i} 桌`,
        type: 'regular',
        seats: Array(SEATS_PER_TABLE).fill(null)
      });
    }
    newTables.push({
      id: `table-${Date.now()}-veg`,
      name: `素食桌`,
      type: 'vegetarian',
      seats: Array(SEATS_PER_TABLE).fill(null)
    });

    // 名單如果是從 DB 讀的，Reset 時應該保留現在的 members，只清空 tables
    // 或者是您想要重置回 INITIAL_MEMBERS? 通常是保留現有名單比較合理
    updateData(members, newTables);
    setShowResetConfirm(false);
    showNotification('座位已重置');
  };

  const handleQuickAddSubmit = (tableIndex, tableId) => {
    const inputVal = quickAddValues[tableId]?.trim();
    if (!inputVal) return;

    const member = members.find(m => m.id === inputVal);
    if (!member) {
      showNotification(`找不到編號 ${inputVal}`, 'error');
      return;
    }

    const targetTable = tables[tableIndex];
    const emptySeatIndex = targetTable.seats.findIndex(s => s === null);
    if (emptySeatIndex === -1) {
      showNotification(`客滿了`, 'error');
      return;
    }

    const isAlreadySeated = tables.some(t => t.seats.some(s => s && s.id === member.id));
    if (isAlreadySeated) {
      if (!window.confirm(`${member.name} 已經在其他座位了，確定要換嗎？`)) return;
    }

    const tablesAfterRemoval = tables.map(t => ({
      ...t,
      seats: t.seats.map(s => (s && s.id === member.id) ? null : s)
    }));
    
    const finalTables = tablesAfterRemoval.map((t, idx) => {
      if (idx === tableIndex) {
        const newSeats = [...t.seats];
        newSeats[emptySeatIndex] = member;
        return { ...t, seats: newSeats };
      }
      return t;
    });

    updateData(members, finalTables);
    setQuickAddValues(prev => ({ ...prev, [tableId]: '' }));
    showNotification(`${member.name} 已加入`);
  };

  // 匯入名單邏輯 (更新 members)
  const confirmImport = () => {
    if (parsedPreviewMembers.length === 0) return;
    // 匯入時，如果選擇覆蓋，就更新 members
    updateData(parsedPreviewMembers, tables);
    setShowImportModal(false);
    showNotification(`匯入成功`);
  };

  // 新增會員邏輯
  const handleAddMember = (e) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberId.trim()) return;
    if (members.some(m => m.id === newMemberId.trim())) {
      showNotification(`編號 ${newMemberId} 已存在`, 'error');
      return;
    }
    const newMember = { id: newMemberId.trim(), name: newMemberName.trim(), isGuest: false };
    const updatedMembers = [...members, newMember].sort((a, b) => parseInt(a.id) - parseInt(b.id));
    
    updateData(updatedMembers, tables);
    setShowAddMember(false);
    setSelectedMember(newMember);
    showNotification(`已新增：${newMember.name}`);
  };

  // 增加桌子邏輯
  const addTable = () => {
    const newTables = [...tables, {
      id: `table-${Date.now()}`,
      name: `加開桌 ${tables.length + 1}`,
      type: 'regular',
      seats: Array(SEATS_PER_TABLE).fill(null)
    }];
    updateData(members, newTables);
    showNotification('已加開一桌');
  };

  // --- 其他輔助函式保持不變 ---
  const handleQuickAddChange = (tableId, value) => setQuickAddValues(prev => ({ ...prev, [tableId]: value }));
  const promptDelete = (tableIndex, seatIndex, memberName) => setDeleteTarget({ tableIndex, seatIndex, memberName });
  const togglePrintPreview = () => setIsPrintPreviewMode(true);
  const executePrint = () => window.print();
  const closePrintPreview = () => setIsPrintPreviewMode(false);
  const resetSeats = () => setShowResetConfirm(true);
  const onFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setImportFile(file);
    readFile(file, 'utf-8');
    setShowImportModal(true);
    event.target.value = '';
  };
  const readFile = (file, encoding) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setRawFileContent(text);
      const parsed = parseContentLogic(text);
      setParsedPreviewMembers(parsed);
      setImportEncoding(encoding);
    };
    reader.readAsText(file, encoding);
  };
  const parseContentLogic = (text) => {
    try {
      const lines = text.split(/\r\n|\n|\r/);
      const tempMembers = [];
      const seenIds = new Set();
      const startLine = (lines[0] && (lines[0].includes('編號') || lines[0].includes('姓名'))) ? 1 : 0;
      for (let i = startLine; i < lines.length; i++) {
        const row = lines[i].trim();
        if (!row) continue;
        let cols = row.split(/[,，\t\s]+/).map(c => c.trim()).filter(c => c);
        for (let j = 0; j < cols.length; j++) {
          const possibleId = cols[j];
          if (possibleId && !isNaN(parseInt(possibleId)) && cols[j+1]) {
             const id = possibleId;
             const name = cols[j+1];
             if (!seenIds.has(id)) {
               tempMembers.push({ id, name, isGuest: false });
               seenIds.add(id);
               j++;
             }
          }
        }
      }
      return tempMembers.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    } catch (e) { return []; }
  };
  const fallbackCopyTextToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { document.execCommand('copy'); showNotification('已複製'); } catch (err) { showNotification('複製失敗', 'error'); }
    document.body.removeChild(textArea);
  };
  const exportList = () => {
    let text = "長青會聚餐座位表\n\n";
    tables.forEach(table => {
      if (table.seats.some(s => s !== null)) {
        text += `【${table.name}】${table.type === 'vegetarian' ? '(素食)' : ''}\n`;
        table.seats.forEach((seat, idx) => { text += `${idx + 1}. ${seat ? seat.name : '(空位)'}\n`; });
        text += "\n";
      }
    });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showNotification('已複製')).catch(() => fallbackCopyTextToClipboard(text));
    } else { fallbackCopyTextToClipboard(text); }
  };
  const initiateAddMember = () => {
    let maxId = 0;
    members.forEach(m => { const num = parseInt(m.id); if (!isNaN(num) && num > maxId) maxId = num; });
    setNewMemberId((maxId + 1).toString()); setNewMemberName(''); setShowAddMember(true);
    setTimeout(() => nameInputRef.current?.focus(), 100);
  };
  const seatedMemberIds = new Set();
  tables.forEach(table => { table.seats.forEach(seat => { if (seat) seatedMemberIds.add(seat.id); }); });
  const filteredMembers = members.filter(m => m.name.includes(searchTerm) || m.id.toString().includes(searchTerm)).sort((a, b) => {
      if (searchTerm) { if (a.id === searchTerm) return -1; if (b.id === searchTerm) return 1; }
      const idA = parseInt(a.id), idB = parseInt(b.id);
      if (isNaN(idA)) return 1; if (isNaN(idB)) return -1;
      return idA - idB;
  });

  if (loading) return <div className="h-screen flex flex-col items-center justify-center gap-4 text-gray-500"><Loader2 className="animate-spin w-10 h-10 text-emerald-600"/><p>正在連線至雲端資料庫...</p><p className="text-sm text-gray-400">若卡住請檢查 Firebase 設定</p></div>;

  if (isPrintPreviewMode) {
    // ... (列印預覽 UI 保持不變，直接複製)
    return (
      <div className="bg-gray-100 min-h-screen">
        <div className="fixed top-0 left-0 right-0 bg-gray-800 text-white p-4 z-50 flex justify-between items-center shadow-lg print:hidden">
          <div className="flex items-center gap-4">
            <button onClick={closePrintPreview} className="flex items-center gap-2 text-gray-300 hover:text-white transition"><ChevronLeft size={20} /> 返回編輯</button>
            <span className="font-bold text-lg">列印預覽模式 (三角立牌版)</span>
          </div>
          <div className="flex gap-3">
            <span className="text-sm text-gray-400 flex items-center gap-2 mr-4"><AlertCircle size={16} /> 提示：請記得勾選「列印背景圖案」</span>
            <button onClick={executePrint} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition"><Printer size={20} /> 立即列印 (Ctrl+P)</button>
          </div>
        </div>
        <div className="pt-20 pb-10 px-4 print:p-0 print:m-0">
          <div className="max-w-[210mm] mx-auto print:w-full print:max-w-none">
            {tables.filter(t => t.seats.some(s => s !== null)).length === 0 ? (
              <div className="text-center py-20 text-gray-500"><p className="text-xl mb-4">目前沒有任何已安排座位的桌子</p><button onClick={closePrintPreview} className="text-emerald-600 hover:underline">返回安排座位</button></div>
            ) : (
              tables.filter(t => t.seats.some(s => s !== null)).map((table) => (
                <div key={table.id} className="bg-white w-full h-[297mm] shadow-xl mb-8 print:shadow-none print:mb-0 print:break-after-page flex flex-col relative overflow-hidden box-border">
                   <div className="absolute top-[33.3%] left-0 w-full border-t border-dashed border-gray-300 flex items-center justify-center"><div className="bg-white px-2 text-gray-400 text-xs flex items-center gap-1"><Scissors size={10}/> 山折線 (Top Fold)</div></div>
                   <div className="absolute top-[66.6%] left-0 w-full border-t border-dashed border-gray-300 flex items-center justify-center"><div className="bg-white px-2 text-gray-400 text-xs flex items-center gap-1"><Scissors size={10}/> 山折線 (Bottom Fold)</div></div>
                   <div className="h-[33.3%] flex flex-col justify-center items-center p-8 bg-white">
                     <div className="transform rotate-180 flex flex-col items-center">
                       <h1 className="text-[6rem] font-black leading-none text-gray-900 mb-2">{table.name}</h1>
                       {table.type === 'vegetarian' && (<div className="flex items-center justify-center gap-2 px-6 py-2 bg-green-100 text-green-800 rounded-full border-4 border-green-500 print:bg-green-100 print:text-green-800 print:border-green-500" style={{WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'}}><Leaf size={32} /><span className="text-3xl font-bold">素食桌</span></div>)}
                     </div>
                   </div>
                   <div className="h-[33.3%] flex flex-col p-4 bg-gray-50/30 print:bg-transparent">
                     <div className="text-center mb-2"><h2 className="text-xl font-bold text-gray-500 tracking-widest border-b-2 border-gray-300 inline-block px-8 pb-1">賓客名單</h2></div>
                     <div className="flex-1 flex flex-row justify-around items-start px-2">
                       {table.seats.map((seat, idx) => (
                         <div key={idx} className="flex flex-col items-center h-full gap-2">
                           <span className="text-sm font-bold text-gray-400 rounded-full border border-gray-300 w-6 h-6 flex items-center justify-center mb-1">{idx + 1}</span>
                           <div className="flex-1 text-2xl font-bold text-gray-900 tracking-[0.3em] py-2 border-l border-gray-100/50" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>{seat ? seat.name : ''}</div>
                         </div>
                       ))}
                     </div>
                   </div>
                   <div className="h-[33.3%] flex flex-col justify-end items-center p-8 text-gray-300"><div className="mb-8 text-center"><p className="text-sm tracking-widest">長青會聚餐</p><p className="text-xs mt-1">請沿虛線折疊即可站立</p></div></div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- 主介面 ---
  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-800 font-sans relative">
      <input type="file" ref={fileInputRef} onChange={onFileChange} accept=".csv,.txt" className="hidden" />
      
      {/* 狀態指示燈 */}
      <div className="fixed top-0 right-0 p-1 z-[100] pointer-events-none">
         {saving ? 
           <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-1 rounded-bl-lg shadow flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> 儲存中...</span> : 
           <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-1 rounded-bl-lg shadow flex items-center gap-1"><Cloud size={10}/> 已同步</span>
         }
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-fade-in print:hidden">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border-2 border-red-100">
            <div className="flex flex-col items-center text-center">
              <div className="bg-red-100 p-3 rounded-full mb-4"><AlertTriangle className="text-red-600 w-8 h-8" /></div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">確定移除？</h3>
              <p className="text-gray-600 mb-6">要將 <span className="font-bold text-gray-900">{deleteTarget.memberName}</span> 移出座位嗎？<br/><span className="text-xs text-gray-400">(之後可重新安排入座)</span></p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition">取消</button>
                <button onClick={confirmDelete} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-md transition">確認移除</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-fade-in print:hidden">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border-2 border-red-100">
            <div className="flex flex-col items-center text-center">
              <div className="bg-red-100 p-3 rounded-full mb-4"><RotateCcw className="text-red-600 w-8 h-8" /></div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">重置所有座位？</h3>
              <p className="text-gray-600 mb-6">這將清空目前所有桌次的安排。<br/><span className="text-xs text-gray-400">(會員名單將保留)</span></p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition">取消</button>
                <button onClick={performReset} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-md transition">確認重置</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-emerald-600 text-white rounded-t-xl">
              <h3 className="font-bold flex items-center gap-2"><FileText size={20}/> 匯入預覽</h3>
              <button onClick={() => setShowImportModal(false)} className="hover:bg-emerald-700 p-1 rounded"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800 font-bold mb-2 flex items-center gap-1"><AlertCircle size={14}/> 亂碼請切換編碼：</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={importEncoding === 'utf-8'} onChange={() => readFile(importFile, 'utf-8')} /><span className="text-sm">UTF-8</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={importEncoding === 'big5'} onChange={() => readFile(importFile, 'big5')} /><span className="text-sm">Big5</span></label>
                </div>
              </div>
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">原始內容：</p>
                <pre className="bg-gray-100 p-3 rounded text-xs h-24 overflow-y-auto font-mono text-gray-600 border">{rawFileContent.slice(0, 300)}...</pre>
              </div>
              <div>
                <p className="font-bold text-gray-700 mb-2">預覽 ({parsedPreviewMembers.length} 人)：</p>
                <div className="bg-emerald-50 border border-emerald-200 rounded p-2 max-h-40 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-2">
                  {parsedPreviewMembers.slice(0, 30).map(m => <div key={m.id} className="text-xs bg-white px-2 py-1 rounded border border-emerald-100 flex gap-2"><span className="font-bold text-emerald-600 w-6">{m.id}</span><span>{m.name}</span></div>)}
                </div>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded">取消</button>
              <button onClick={confirmImport} disabled={parsedPreviewMembers.length === 0} className={`px-6 py-2 rounded font-bold text-white flex items-center gap-2 ${parsedPreviewMembers.length > 0 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-400'}`}><Check size={18} /> 匯入</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-emerald-600 text-white p-3 shadow-md flex flex-wrap gap-2 justify-between items-center z-10 print:hidden">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <h1 className="text-xl font-bold hidden md:block">長青會排桌</h1>
          <h1 className="text-lg font-bold md:hidden">排桌系統</h1>
        </div>
        <div className="flex gap-2 items-center">
           <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 rounded text-sm border border-emerald-400 font-medium"><Upload size={16} /> 匯入</button>
           <button onClick={togglePrintPreview} className="flex items-center gap-1 bg-white text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Printer size={16} /> 列印桌卡</button>
           <button onClick={exportList} className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 rounded text-sm border border-emerald-600"><Download size={16} /> <span className="hidden sm:inline">複製</span></button>
           <button onClick={resetSeats} className="flex items-center gap-1 bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded text-sm"><RotateCcw size={16} /></button>
        </div>
      </header>

      {notification && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-2 rounded-full shadow-lg z-[60] text-white print:hidden ${notification.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>{notification.msg}</div>
      )}

      <main className="flex flex-1 overflow-hidden print:hidden">
        <aside className="w-1/3 md:w-1/4 bg-white border-r flex flex-col shadow-lg z-0">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-bold text-gray-700 mb-3 flex justify-between items-center">
              會員名單 <span className="text-xs font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{seatedMemberIds.size} / {members.length} 入座</span>
            </h2>
            <div className="relative mb-3 group">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="搜尋..." className="w-full pl-9 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-0.5"><X size={14}/></button>}
            </div>
            {!showAddMember ? (
              <button onClick={initiateAddMember} className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition text-sm font-medium"><UserPlus size={16} /> 新增會員</button>
            ) : (
              <form onSubmit={handleAddMember} className="bg-emerald-50 p-2 rounded-lg border border-emerald-200 shadow-sm animate-fade-in">
                <div className="flex justify-between items-center mb-2 text-xs text-emerald-800 font-bold"><span>新增會員</span><button type="button" onClick={() => setShowAddMember(false)} className="text-gray-400 hover:text-gray-600"><X size={14}/></button></div>
                <div className="flex gap-2 mb-2">
                  <input type="text" className="w-1/3 px-2 py-1.5 border rounded text-sm outline-none" value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)} placeholder="#" />
                  <input ref={nameInputRef} type="text" className="w-2/3 px-2 py-1.5 border rounded text-sm outline-none" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="姓名" />
                </div>
                <button type="submit" className="w-full bg-emerald-600 text-white py-1.5 rounded text-sm hover:bg-emerald-700 flex items-center justify-center gap-1"><Check size={14} /> 確認</button>
              </form>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
            {filteredMembers.map((member) => {
              const isSeated = seatedMemberIds.has(member.id);
              const isSelected = selectedMember?.id === member.id;
              return (
                <div key={member.id} onClick={() => setSelectedMember(isSelected ? null : member)} className={`flex items-center justify-between p-2 mb-1.5 rounded-lg cursor-pointer transition select-none ${isSeated ? 'bg-gray-50 text-gray-400 opacity-60' : isSelected ? 'bg-emerald-600 text-white shadow-md transform scale-[1.02]' : 'bg-white border hover:border-emerald-300 hover:shadow-sm'}`}>
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isSeated ? 'bg-gray-200' : isSelected ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{isNaN(member.id) ? '賓' : member.id}</div>
                    <span className="font-medium truncate">{member.name}</span>
                  </div>
                  {isSeated && <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">已入座</span>}
                  {!isSeated && member.isGuest && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">賓客</span>}
                </div>
              );
            })}
            {filteredMembers.length === 0 && <div className="flex flex-col items-center justify-center text-gray-400 py-8 text-sm gap-2"><FileSpreadsheet className="h-8 w-8 opacity-20" /><p>無符合資料</p></div>}
          </div>
        </aside>

        <section className="flex-1 bg-gray-100 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r shadow-sm flex flex-wrap gap-4 justify-between items-center sticky top-0 z-10 backdrop-blur-sm bg-blue-50/90">
              <div>
                <p className="font-bold text-blue-700">{selectedMember ? `已選擇：${selectedMember.name}` : "操作模式"}</p>
                <p className="text-sm text-blue-600">{selectedMember ? `請點擊下方任一空位入座。` : "1. 從左側點選人員入座，或使用下方的快速輸入編號。"}</p>
              </div>
              <button onClick={addTable} className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg border border-blue-200 hover:bg-blue-50 font-medium shadow-sm transition"><PlusCircle size={18} /> 加開一桌</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
              {tables.map((table, tIndex) => {
                const isVeg = table.type === 'vegetarian';
                const currentCount = table.seats.filter(s=>s).length;
                return (
                  <div key={table.id} className={`rounded-xl shadow border overflow-hidden flex flex-col ${isVeg ? 'border-lime-300 bg-lime-50' : 'bg-white border-gray-200'}`}>
                    <div className={`p-2 px-3 flex justify-between items-center ${isVeg ? 'bg-lime-600 text-white' : 'bg-gray-700 text-white'}`}>
                      <div className="flex items-center gap-2">{isVeg && <Leaf size={16} />}<h3 className="font-bold text-md">{table.name}</h3></div>
                      <span className={`text-xs px-2 py-0.5 rounded ${currentCount === 10 ? 'bg-red-400 text-white' : 'bg-black/30'}`}>{currentCount} / {SEATS_PER_TABLE}</span>
                    </div>
                    
                    <div className="p-3 grid grid-cols-2 gap-2 flex-1">
                      {table.seats.map((seat, sIndex) => (
                        <div key={sIndex} className={`relative h-12 rounded-md border transition-all text-sm ${seat ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium' : selectedMember ? 'bg-white border-dashed border-emerald-400 hover:bg-emerald-50' : isVeg ? 'bg-lime-50/50 border-dashed border-lime-300 hover:border-lime-400' : 'bg-gray-50 border-dashed border-gray-200 hover:border-gray-300'}`}>
                          <div className="absolute inset-0 z-0 cursor-pointer flex items-center justify-center" onClick={() => handleSeatClick(tIndex, sIndex)}>{!seat && <span className="text-xs text-gray-300 select-none">{sIndex + 1}</span>}</div>
                          {seat && (<div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center px-6"><span className="truncate w-full text-center">{seat.name}</span></div>)}
                          {seat && (<button type="button" className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/90 text-red-500 rounded-full p-1 hover:bg-red-500 hover:text-white transition shadow-sm z-50 cursor-pointer" onClick={(e) => { e.stopPropagation(); promptDelete(tIndex, sIndex, seat.name); }} title="移除"><Trash2 size={12} /></button>)}
                        </div>
                      ))}
                    </div>

                    <div className="p-2 border-t bg-gray-50 flex gap-2">
                      <div className="relative flex-1">
                        <input type="text" placeholder="編號" className="w-full pl-7 pr-2 py-1.5 text-sm border rounded focus:border-emerald-500 outline-none" value={quickAddValues[table.id] || ''} onChange={(e) => handleQuickAddChange(table.id, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAddSubmit(tIndex, table.id); }} />
                        <UserCheck className="absolute left-2 top-2 text-gray-400" size={14} />
                      </div>
                      <button onClick={() => handleQuickAddSubmit(tIndex, table.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-xs font-bold transition">加入</button>
                    </div>
                  </div>
                );
              })}
              <button onClick={addTable} className="flex flex-col items-center justify-center h-full min-h-[250px] border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50 transition"><PlusCircle size={32} className="mb-2 opacity-50" /><span className="font-medium">加開新桌次</span></button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;