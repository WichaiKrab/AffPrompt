import React, { useState, useEffect, useRef } from 'react';
import { Camera, Image as ImageIcon, Video, Upload, ChevronRight, MessageSquare, CheckCircle, RefreshCcw, Loader2, Sparkles, LayoutPanelLeft, Copy, Check, History, X, Download, Trash2 } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

interface PromptResult {
  name: string;
  description: string;
  imagePrompt: string;
  videoPrompt: string;
}

interface FormData {
  category: string;
  customCategory: string;
  productDetail: string;
  style: string;
  setting: string;
  vibe: string;
  negativePrompt: string;
  faceImage: string | null;
  aspectRatio: string;
}

interface HistoryItem {
  id: number;
  date: string;
  formData: FormData;
  results: PromptResult[];
}

export default function App() {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    faceImage: null as string | null,
    category: '',
    customCategory: '',
    productDetail: '',
    style: 'Photorealistic (ภาพสมจริง)',
    setting: '',
    vibe: '',
    negativePrompt: '',
    aspectRatio: '9:16'
  });

  const [results, setResults] = useState<PromptResult[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [generatedMedia, setGeneratedMedia] = useState<{
    [key: number]: { image?: string, imageLoading?: boolean }
  }>({});

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/history');
        if (response.ok) {
          const data = await response.json();
          setHistory(data);
        }
      } catch (e) {
        console.error("Failed to fetch history", e);
        // Fallback to local storage if API fails
        const savedHistory = localStorage.getItem('promptHistory');
        if (savedHistory) setHistory(JSON.parse(savedHistory));
      }
    };
    fetchHistory();
  }, []);

  const categories = [
    'เสื้อผ้า (เสื้อ/กางเกง)', 
    'ฮิญาบ / ผ้าคลุมผม', 
    'รองเท้า / รองเท้าแตะ', 
    'กระเป๋า / เป้สะพาย',
    'อาหาร / เครื่องดื่ม', 
    'สกินแคร์ / เครื่องสำอาง', 
    'เครื่องประดับ',
    'อุปกรณ์อิเล็กทรอนิกส์ / แกดเจ็ต',
    'ของใช้ในบ้าน / ตกแต่งบ้าน',
    'อื่นๆ (ระบุเอง)'
  ];
  
  const styles = ['Photorealistic (ภาพสมจริง)', 'Cinematic (ภาพยนตร์)', 'Studio Lighting (แสงสตูดิโอ)', 'Anime / Manga (อนิเมะ/มังงะ)', '3D Render (ภาพ 3 มิติ)', 'Minimalist (มินิมอล)'];
  const settingSuggestions = ['สตูดิโอมินิมอลสีขาว', 'คาเฟ่สไตล์เก๋ไก๋', 'ห้องนอนแสนอบอุ่น', 'ถนนในเมือง (สตรีทสไตล์)', 'ธรรมชาติ / สวน'];
  const vibeSuggestions = ['ภาพยนตร์ & ดราม่า', 'โฉบเฉี่ยว & โดดเด่น', 'สนุกสนาน & ร่าเริง', 'หรูหรา & สง่างาม', 'ลำลอง & สบายๆ'];

  const handleNext = () => setStep(step + 1);
  const handleReset = () => {
    setStep(1);
    setActiveTab(0);
    setFormData({ ...formData, faceImage: null, category: '', customCategory: '', productDetail: '', style: 'Photorealistic (ภาพสมจริง)', setting: '', vibe: '', negativePrompt: '' });
    setResults([]);
    setGeneratedMedia({});
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const uploadToast = toast.loading("กำลังอัปโหลดรูปภาพ...");
      try {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formDataUpload,
        });

        if (!response.ok) throw new Error("Upload failed");

        const data = await response.json();
        setFormData({ ...formData, faceImage: data.url });
        toast.success("อัปโหลดรูปภาพสำเร็จ", { id: uploadToast });
      } catch (error) {
        console.error("Error uploading image:", error);
        toast.error("เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ", { id: uploadToast });
      }
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.preventDefault();
    setFormData({ ...formData, faceImage: null });
  };

  const generatePromptsWithAI = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error("Failed to generate prompts");
      }

      const posesWithAR = await response.json();

      setResults(posesWithAR);
      setGeneratedMedia({});
      toast.success("สร้าง Prompt สำเร็จ!");
      
      // Save to history via API
      try {
        const historyResponse = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formData, results: posesWithAR })
        });
        
        if (historyResponse.ok) {
          const historyItem = await historyResponse.json();
          const newHistory = [{
            id: historyItem.id,
            date: historyItem.date,
            formData,
            results: posesWithAR
          }, ...history];
          setHistory(newHistory);
          localStorage.setItem('promptHistory', JSON.stringify(newHistory));
        }
      } catch (e) {
        console.error("Failed to save history to DB", e);
        // Fallback to local storage only
        const historyItem = {
          id: Date.now(),
          date: new Date().toLocaleString(),
          formData,
          results: posesWithAR
        };
        const newHistory = [historyItem, ...history];
        setHistory(newHistory);
        localStorage.setItem('promptHistory', JSON.stringify(newHistory));
      }

      setStep(3);
      setActiveTab(0);
    } catch (error) {
      console.error("Error generating prompts:", error);
      toast.error("เกิดข้อผิดพลาดในการสร้าง Prompt กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImagePreview = async (index: number, prompt: string) => {
    setGeneratedMedia(prev => ({ ...prev, [index]: { ...prev[index], imageLoading: true } }));
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio: formData.aspectRatio })
      });

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await response.json();
      
      if (data.imageUrl) {
        setGeneratedMedia(prev => ({ ...prev, [index]: { ...prev[index], image: data.imageUrl, imageLoading: false } }));
      } else {
        throw new Error("No image generated");
      }
    } catch (error) {
      console.error("Image generation error:", error);
      toast.error("เกิดข้อผิดพลาดในการสร้างรูปภาพพรีวิว");
      setGeneratedMedia(prev => ({ ...prev, [index]: { ...prev[index], imageLoading: false } }));
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
      toast.success("คัดลอกสำเร็จ!");
    } catch (err) {
      console.error('คัดลอกข้อความไม่สำเร็จ', err);
      toast.error("คัดลอกข้อความไม่สำเร็จ");
    }
    document.body.removeChild(textArea);
  };

  const handlePromptChange = (index: number, type: 'imagePrompt' | 'videoPrompt', value: string) => {
    const newResults = [...results];
    newResults[index][type] = value;
    setResults(newResults);
  };

  const exportToTxt = () => {
    let content = `Affiliate Prompts Export\nGenerated on: ${new Date().toLocaleString()}\n\n`;
    
    results.forEach((res, idx) => {
      content += `--- Option ${idx + 1}: ${res.name} ---\n`;
      content += `Description: ${res.description}\n\n`;
      content += `Image Prompt:\n${res.imagePrompt}\n\n`;
      content += `Video Prompt:\n${res.videoPrompt}\n\n`;
      content += `----------------------------------------\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteHistory = async (id: number) => {
    try {
      await fetch(`/api/history/${id}`, { method: 'DELETE' });
      const newHistory = history.filter(item => item.id !== id);
      setHistory(newHistory);
      localStorage.setItem('promptHistory', JSON.stringify(newHistory));
      toast.success("ลบประวัติสำเร็จ");
    } catch (e) {
      console.error("Failed to delete history", e);
      toast.error("ไม่สามารถลบประวัติจากฐานข้อมูลได้");
    }
  };

  const isStep1Valid = formData.category && formData.productDetail && (formData.category !== 'อื่นๆ (ระบุเอง)' || formData.customCategory.trim() !== '');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8 pb-20 relative">
      <Toaster position="top-center" />
      {/* History Button */}
      <button 
        onClick={() => setShowHistory(true)} 
        className="absolute top-4 right-4 md:top-8 md:right-8 p-2 px-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 flex items-center gap-2 text-sm font-semibold text-slate-700 transition-colors z-10"
      >
        <History className="w-4 h-4" /> ประวัติ
      </button>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800"><History className="w-5 h-5 text-indigo-600" /> ประวัติการสร้าง Prompt</h2>
              <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-grow space-y-4 bg-slate-50">
              {history.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <History className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium">ยังไม่มีประวัติการสร้าง</p>
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
                          {item.formData.category === 'อื่นๆ (ระบุเอง)' ? item.formData.customCategory : item.formData.category}
                        </span>
                        <h3 className="font-bold text-lg mt-3 text-slate-800">{item.formData.productDetail}</h3>
                      </div>
                      <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{item.date}</span>
                    </div>
                    <div className="flex gap-4 text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div><span className="font-semibold text-slate-700">Setting:</span> {item.formData.setting}</div>
                      <div><span className="font-semibold text-slate-700">Vibe:</span> {item.formData.vibe}</div>
                    </div>
                    <div className="flex justify-between items-center">
                      <button 
                        onClick={() => {
                          setFormData(item.formData);
                          setResults(item.results);
                          setStep(3);
                          setShowHistory(false);
                        }}
                        className="text-sm text-indigo-600 font-semibold hover:text-indigo-700 flex items-center gap-1"
                      >
                        ดูผลลัพธ์นี้อีกครั้ง <ChevronRight className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteHistory(item.id)}
                        className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1 p-1"
                        title="ลบประวัตินี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto pt-8">
        
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center justify-center gap-2 mb-2">
            Affiliate Prompt Generator Pro
          </h1>
          <p className="text-slate-500">ระบบสร้างพรอมต์อัจฉริยะสำหรับสินค้า Affiliate พร้อม AI เต็มรูปแบบ</p>
        </header>

        {/* Progress Bar */}
        <div className="flex justify-between items-center mb-8 relative px-4 md:px-12">
          <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-1 bg-slate-200 -z-10 rounded"></div>
          <div className={`absolute left-10 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 -z-10 rounded transition-all duration-500`} style={{ width: `calc(${(step - 1) * 50}% - 40px)` }}></div>
          
          {[1, 2, 3].map((num) => (
            <div key={num} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-4 transition-colors ${step >= num ? 'bg-indigo-600 text-white border-indigo-200 shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-400 border-white'}`}>
              {num}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          
          {/* STEP 1: INPUT DATA */}
          {step === 1 && (
            <div className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                ขั้นตอนที่ 1: ข้อมูลพื้นฐานของสินค้า
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Upload Area */}
                <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-indigo-400 transition-colors cursor-pointer bg-slate-50 relative overflow-hidden group h-full min-h-[300px]">
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/webp" 
                    className="hidden" 
                    onChange={handleImageUpload}
                  />
                  
                  {formData.faceImage ? (
                    <>
                      <img src={formData.faceImage} alt="Preview Wajah" className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-20 transition-opacity" />
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
                          <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="font-semibold mb-1 text-slate-800">รูปภาพที่เลือก</h3>
                        <p className="text-xs text-slate-600 mb-4 bg-white/80 px-2 py-1 rounded">พร้อมใช้เป็นรูปอ้างอิง</p>
                        <button 
                          onClick={handleRemoveImage}
                          className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors shadow-sm relative z-20"
                        >
                          ลบ / เปลี่ยน
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                        <ImageIcon className="w-8 h-8 text-indigo-600" />
                      </div>
                      <h3 className="font-semibold mb-1">อัปโหลดรูปภาพอ้างอิง</h3>
                      <p className="text-sm text-slate-500 mb-4">รูปสินค้าหรือใบหน้าตัวละคร (ไม่บังคับ)</p>
                      <div className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 pointer-events-none">เลือกไฟล์</div>
                    </>
                  )}
                </label>

                {/* Form Inputs */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">หมวดหมู่สินค้า *</label>
                    <select 
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                    >
                      <option value="">-- เลือกหมวดหมู่ --</option>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    
                    {formData.category === 'อื่นๆ (ระบุเอง)' && (
                      <input 
                        type="text" 
                        placeholder="ระบุหมวดหมู่สินค้าของคุณ..." 
                        className="w-full mt-3 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all animate-in fade-in slide-in-from-top-2"
                        value={formData.customCategory}
                        onChange={(e) => setFormData({...formData, customCategory: e.target.value})}
                      />
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">รายละเอียดสินค้าเฉพาะ *</label>
                    <input 
                      type="text" 
                      placeholder="เช่น: เสื้อเชิ้ตลายสก็อตสีแดง, รองเท้าวิ่งสีขาว" 
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      value={formData.productDetail}
                      onChange={(e) => setFormData({...formData, productDetail: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">สัดส่วนภาพ (Aspect Ratio) *</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { label: 'TikTok/Reels', value: '9:16', icon: '📱' },
                        { label: 'YouTube', value: '16:9', icon: '💻' },
                        { label: 'IG Square', value: '1:1', icon: '⏹️' },
                        { label: 'IG Portrait', value: '4:5', icon: '🖼️' }
                      ].map(ar => (
                        <button
                          key={ar.value}
                          onClick={() => setFormData({...formData, aspectRatio: ar.value})}
                          className={`p-3 border rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all ${formData.aspectRatio === ar.value ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 hover:border-indigo-300 bg-white text-slate-600'}`}
                        >
                          <span className="text-xl">{ar.icon}</span>
                          <span className="text-xs font-bold">{ar.value}</span>
                          <span className="text-[10px] opacity-70">{ar.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">สไตล์ภาพ (Style) *</label>
                    <select 
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                      value={formData.style}
                      onChange={(e) => setFormData({...formData, style: e.target.value})}
                    >
                      {styles.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={handleNext}
                  disabled={!isStep1Valid}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-indigo-200"
                >
                  ดำเนินการต่อเพื่อปรับแต่ง <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CLARIFICATION (AI QUESTIONS) */}
          {step === 2 && (
            <div className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-50">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                ขั้นตอนที่ 2: การตรวจสอบด้วย AI
              </h2>
              
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm mb-6">
                <div className="flex gap-4 mb-6 pb-6 border-b border-slate-100">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                  </div>
                  <p className="text-slate-700 leading-relaxed pt-2">
                    น่าสนใจมาก! คุณเลือกสินค้า <span className="font-bold text-indigo-600">{formData.productDetail}</span> (หมวดหมู่: {formData.category === 'อื่นๆ (ระบุเอง)' ? formData.customCategory : formData.category}). เพื่อสร้างตัวเลือกท่าโพสที่ดึงดูดใจ ฉันต้องการข้อมูลเพิ่มเติมอีกเล็กน้อย:
                  </p>
                </div>
                
                <div className="space-y-8">
                  {/* Setting Input */}
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-3">1. พื้นหลัง (Setting) แบบไหนที่เหมาะสม?</label>
                    <input 
                      type="text" 
                      placeholder="พิมพ์พื้นหลังด้วยตนเองหรือเลือกจากคำแนะนำด้านล่าง..." 
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none mb-3 bg-slate-50"
                      value={formData.setting}
                      onChange={(e) => setFormData({...formData, setting: e.target.value})}
                    />
                    <div className="flex flex-wrap gap-2">
                      {settingSuggestions.map(sug => (
                        <button 
                          key={sug}
                          onClick={() => setFormData({...formData, setting: sug})}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 rounded-full text-xs font-medium text-slate-600 transition-colors"
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Vibe Input */}
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-3">2. บรรยากาศ (Vibe/Mood) ที่ต้องการเน้น?</label>
                    <input 
                      type="text" 
                      placeholder="พิมพ์บรรยากาศด้วยตนเองหรือเลือกจากคำแนะนำด้านล่าง..." 
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none mb-3 bg-slate-50"
                      value={formData.vibe}
                      onChange={(e) => setFormData({...formData, vibe: e.target.value})}
                    />
                    <div className="flex flex-wrap gap-2">
                      {vibeSuggestions.map(sug => (
                        <button 
                          key={sug}
                          onClick={() => setFormData({...formData, vibe: sug})}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 rounded-full text-xs font-medium text-slate-600 transition-colors"
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Negative Prompt Input */}
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-3">3. สิ่งที่ไม่ต้องการให้มีในภาพ (Negative Prompt) <span className="text-slate-400 font-normal text-xs">(ไม่บังคับ)</span></label>
                    <input 
                      type="text" 
                      placeholder="เช่น: ห้ามมีคนอื่นในภาพ, ห้ามภาพเบลอ, ห้ามมีตัวหนังสือ..." 
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-slate-50"
                      value={formData.negativePrompt}
                      onChange={(e) => setFormData({...formData, negativePrompt: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-8">
                <button 
                  onClick={() => setStep(1)}
                  disabled={isGenerating}
                  className="px-6 py-3 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
                >
                  ย้อนกลับ
                </button>
                <button 
                  onClick={generatePromptsWithAI}
                  disabled={isGenerating || !formData.setting || !formData.vibe}
                  className="bg-indigo-600 text-white px-6 md:px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> กำลังให้ AI คิดท่าโพส...</>
                  ) : (
                    <><Sparkles className="w-5 h-5" /> สร้าง 5 ตัวเลือกท่าโพสด้วย AI</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: RESULTS (5 VARIATIONS) */}
          {step === 3 && results.length > 0 && (
            <div className="flex flex-col md:flex-row min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Sidebar: Pose Selection */}
              <div className="w-full md:w-1/3 border-r border-slate-200 bg-slate-50 p-4 md:p-6 flex flex-col">
                <h3 className="font-bold flex items-center gap-2 mb-6 text-slate-800">
                  <LayoutPanelLeft className="w-5 h-5 text-indigo-600" />
                  5 ท่าโพสแนะนำจาก AI
                </h3>
                <p className="text-xs text-slate-500 mb-4 pb-4 border-b border-slate-200">
                  ระบบได้วิเคราะห์หมวดหมู่ <strong>{formData.category === 'อื่นๆ (ระบุเอง)' ? formData.customCategory : formData.category}</strong> และแนะนำมุมกล้องที่ดีที่สุด
                </p>
                
                <div className="space-y-3 overflow-y-auto flex-grow pr-2">
                  {results.map((result, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setActiveTab(idx)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                        activeTab === idx 
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-md transform scale-[1.02]' 
                        : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold opacity-80 uppercase tracking-wider">ตัวเลือก {idx + 1}</span>
                        {activeTab === idx && <CheckCircle className="w-4 h-4" />}
                      </div>
                      <h4 className="font-bold text-sm mb-1">{result.name}</h4>
                      <p className={`text-xs line-clamp-2 ${activeTab === idx ? 'text-indigo-100' : 'text-slate-500'}`}>
                        {result.description}
                      </p>
                    </button>
                  ))}
                </div>
                
                <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
                  <button 
                    onClick={exportToTxt}
                    className="w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-slate-800 rounded-xl hover:bg-slate-900 transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4" /> ดาวน์โหลดทั้งหมด (.txt)
                  </button>
                  <button onClick={handleReset} className="w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors">
                    <RefreshCcw className="w-4 h-4" /> เริ่มสร้างใหม่
                  </button>
                </div>
              </div>

              {/* Main Area: Prompt Results */}
              <div className="w-full md:w-2/3 p-6 md:p-8 bg-white">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">{results[activeTab].name}</h2>
                  <p className="text-slate-600 bg-slate-100 inline-block px-3 py-1 rounded-lg text-sm font-medium border border-slate-200">
                    โฟกัส: {results[activeTab].description}
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Image Prompt */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 relative group">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2 text-indigo-700 font-bold">
                        <ImageIcon className="w-5 h-5" />
                        พรอมต์รูปภาพ (แก้ไขได้)
                      </div>
                      <button 
                        onClick={() => generateImagePreview(activeTab, results[activeTab].imagePrompt)}
                        disabled={generatedMedia[activeTab]?.imageLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {generatedMedia[activeTab]?.imageLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        สร้างพรีวิวรูปภาพ
                      </button>
                    </div>
                    <div className="relative mb-4">
                      <textarea 
                        className="w-full h-32 p-4 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 resize-none focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                        value={results[activeTab].imagePrompt}
                        onChange={(e) => handlePromptChange(activeTab, 'imagePrompt', e.target.value)}
                      />
                      <button 
                        onClick={() => copyToClipboard(results[activeTab].imagePrompt, 'image')}
                        className={`absolute bottom-2 right-2 p-2 px-3 flex items-center gap-2 rounded-md text-xs font-bold transition-colors shadow-sm ${copiedType === 'image' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 hover:bg-indigo-100 text-indigo-600'}`}
                      >
                        {copiedType === 'image' ? <><Check className="w-3 h-3" /> คัดลอกแล้ว</> : <><Copy className="w-3 h-3" /> คัดลอกพรอมต์</>}
                      </button>
                    </div>
                    {generatedMedia[activeTab]?.image && (
                      <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden bg-white p-2">
                        <img src={generatedMedia[activeTab].image} alt="Generated Preview" className="w-full max-h-[400px] object-contain rounded" />
                      </div>
                    )}
                  </div>

                  {/* Video Prompt */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 relative group">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2 text-blue-700 font-bold">
                        <Video className="w-5 h-5" />
                        พรอมต์วิดีโอสั้น (แก้ไขได้)
                      </div>
                    </div>
                    <div className="relative mb-4">
                      <textarea 
                        className="w-full h-32 p-4 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 resize-none focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                        value={results[activeTab].videoPrompt}
                        onChange={(e) => handlePromptChange(activeTab, 'videoPrompt', e.target.value)}
                      />
                      <button 
                        onClick={() => copyToClipboard(results[activeTab].videoPrompt, 'video')}
                        className={`absolute bottom-2 right-2 p-2 px-3 flex items-center gap-2 rounded-md text-xs font-bold transition-colors shadow-sm ${copiedType === 'video' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 hover:bg-blue-100 text-blue-600'}`}
                      >
                         {copiedType === 'video' ? <><Check className="w-3 h-3" /> คัดลอกแล้ว</> : <><Copy className="w-3 h-3" /> คัดลอกพรอมต์</>}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
