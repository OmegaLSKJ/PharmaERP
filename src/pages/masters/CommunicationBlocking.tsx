import { useState } from 'react'
import { Plus, Mail, MessageSquare, Ban, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Block { id:string; type:'email'|'sms'|'whatsapp'; value:string; reason:string; blockedOn:string }

const INIT: Block[] = [
  { id:'1', type:'sms', value:'+91-98200-12345', reason:'Customer requested no SMS', blockedOn:'2026-02-10' },
  { id:'2', type:'email', value:'spam@junkmail.com', reason:'Invalid / bounced address', blockedOn:'2026-01-22' },
  { id:'3', type:'whatsapp', value:'+91-99870-55512', reason:'DND registered number', blockedOn:'2026-03-01' },
]

const TYPE_ICON = { email:<Mail size={13}/>, sms:<MessageSquare size={13}/>, whatsapp:<MessageSquare size={13}/> }
const TYPE_STYLE: Record<string,string> = { email:'bg-blue-500/10 text-blue-400', sms:'bg-emerald-500/10 text-emerald-400', whatsapp:'bg-purple-500/10 text-purple-400' }

export default function CommunicationBlocking() {
  const [blocks,setBlocks] = useState<Block[]>(INIT)
  const [value,setValue] = useState('')
  const [type,setType] = useState<'email'|'sms'|'whatsapp'>('sms')
  const [reason,setReason] = useState('')
  const add = () => {
    if (!value) return
    setBlocks([...blocks,{id:Date.now().toString(),type,value,reason,blockedOn:new Date().toISOString().slice(0,10)}])
    setValue(''); setReason('')
  }
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight text-white">Communication Blocking</h1>
        <p className="text-sm text-slate-400 mt-1 flex items-center gap-2"><Ban size={14} className="text-rose-400"/>Block Email ID / Mobile for messages (SMS, WhatsApp, Email)</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3 h-fit">
          <h3 className="text-sm font-semibold text-white">Add to Block List</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Channel</label>
            <div className="flex rounded-lg border border-slate-800 overflow-hidden">
              {(['sms','whatsapp','email'] as const).map(t=>(<button key={t} onClick={()=>setType(t)} className={cn('flex-1 p-2 text-xs font-medium capitalize transition',type===t?'bg-indigo-600 text-white':'bg-slate-950 text-slate-400')}>{t}</button>))}
            </div>
          </div>
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Email / Mobile</label>
            <input value={value} onChange={e=>setValue(e.target.value)} placeholder="+91-... or name@mail.com" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"/></div>
          <div><label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Reason</label>
            <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason for blocking" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"/></div>
          <button onClick={add} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-semibold shadow-md"><Plus size={16}/> Block Communication</button>
        </div>
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-slate-800"><h3 className="text-sm font-semibold text-white">Blocked ({blocks.length})</h3></div>
          <table className="w-full text-xs"><tbody className="divide-y divide-slate-800 text-slate-300">
            {blocks.map(b=>(<tr key={b.id} className="hover:bg-slate-900/30">
              <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize inline-flex items-center gap-1',TYPE_STYLE[b.type])}>{TYPE_ICON[b.type]}{b.type}</span></td>
              <td className="px-4 py-3 font-mono text-white">{b.value}</td>
              <td className="px-4 py-3 text-slate-400">{b.reason}</td>
              <td className="px-4 py-3 font-mono text-slate-500">{b.blockedOn}</td>
              <td className="px-4 py-3 text-right"><button onClick={()=>setBlocks(blocks.filter(x=>x.id!==b.id))} className="p-1 hover:text-rose-400 text-slate-400"><Trash2 size={13}/></button></td>
            </tr>))}
          </tbody></table>
        </div>
      </div>
    </div>
  )
}
