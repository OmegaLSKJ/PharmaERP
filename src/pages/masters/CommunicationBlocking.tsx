import { useState } from 'react'
import { Plus, Mail, MessageSquare, Ban, Trash2, Pencil } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useEffect } from 'react'
import { deleteErp, getErp, patchErp, postErp } from '../../lib/erpApi'
import { useUIStore } from '../../store/uiStore'

interface Block { id:string; type:'email'|'sms'|'whatsapp'; value:string; reason:string; blockedOn:string }

const TYPE_ICON = { email:<Mail size={13}/>, sms:<MessageSquare size={13}/>, whatsapp:<MessageSquare size={13}/> }
const TYPE_STYLE: Record<string,string> = { email:'bg-blue-500/10 text-blue-400', sms:'bg-emerald-500/10 text-emerald-400', whatsapp:'bg-purple-500/10 text-purple-400' }

export default function CommunicationBlocking() {
  const [blocks,setBlocks] = useState<Block[]>([])
  const [value,setValue] = useState('')
  const [type,setType] = useState<'email'|'sms'|'whatsapp'>('sms')
  const [reason,setReason] = useState('')
  const addToast = useUIStore((s) => s.addToast)
  useEffect(() => { getErp<Block[]>('communication-blocks').then(setBlocks).catch((e) => addToast(e.message, 'error')) }, [addToast])
  const add = async () => {
    if (!value) return
    try { const created = await postErp<Block>('communication-blocks', { type, value, reason }); setBlocks((rows) => [created, ...rows]); setValue(''); setReason(''); addToast('Communication blocked', 'success') } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to add block', 'error') }
  }
  const removeBlock = async (block: Block) => { try { await deleteErp('communication-blocks', block.id); setBlocks((rows) => rows.filter((row) => row.id !== block.id)); addToast('Block removed', 'success') } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to remove block', 'error') } }
  const editBlock=async(block:Block)=>{const value=window.prompt('Email / mobile',block.value);if(!value)return;const reason=window.prompt('Reason',block.reason)??block.reason;try{const updated=await patchErp<Block>('communication-blocks',block.id,{value,reason,type:block.type});setBlocks((rows)=>rows.map((row)=>row.id===block.id?updated:row));addToast('Block updated','success')}catch(error){addToast(error instanceof Error?error.message:'Unable to update block','error')}}
  return (
    <div className="p-3 sm:p-6 space-y-4">
      <div><h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Communication Blocking</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex items-center gap-2"><Ban size={14} className="text-rose-500 dark:text-rose-400"/>Block Email ID / Mobile for messages (SMS, WhatsApp, Email)</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 bg-card border border-border rounded-xl p-4 sm:p-5 space-y-3 h-fit shadow-xs">
          <h3 className="text-sm font-semibold text-foreground">Add to Block List</h3>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Channel</label>
            <div className="flex rounded-lg border border-border overflow-hidden bg-secondary/50">
              {(['sms','whatsapp','email'] as const).map(t=>(<button key={t} onClick={()=>setType(t)} className={cn('flex-1 p-2 text-xs font-medium capitalize transition cursor-pointer',type===t?'bg-indigo-600 text-white shadow-xs':'text-muted-foreground hover:text-foreground')}>{t}</button>))}
            </div>
          </div>
          <div><label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Email / Mobile</label>
            <input value={value} onChange={e=>setValue(e.target.value)} placeholder="+91-... or name@mail.com" className="w-full bg-background border border-border rounded-lg p-2 text-foreground text-sm outline-none focus:border-indigo-500"/></div>
          <div><label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Reason</label>
            <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason for blocking" className="w-full bg-background border border-border rounded-lg p-2 text-foreground text-sm outline-none focus:border-indigo-500"/></div>
          <button onClick={add} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-semibold shadow-md cursor-pointer transition"><Plus size={16}/> Block Communication</button>
        </div>
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden shadow-xs h-fit">
          <div className="px-4 py-3 border-b border-border"><h3 className="text-sm font-semibold text-foreground">Blocked ({blocks.length})</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[500px]"><tbody className="divide-y divide-border text-foreground">
              {blocks.map(b=>(<tr key={b.id} className="hover:bg-secondary/40">
                <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold capitalize inline-flex items-center gap-1',TYPE_STYLE[b.type])}>{TYPE_ICON[b.type]}{b.type}</span></td>
                <td className="px-4 py-3 font-mono text-foreground">{b.value}</td>
                <td className="px-4 py-3 text-muted-foreground">{b.reason}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{b.blockedOn}</td>
                <td className="px-4 py-3 text-right"><button aria-label={`Edit ${b.value}`} onClick={()=>editBlock(b)} className="p-1 hover:text-blue-500 text-muted-foreground cursor-pointer"><Pencil size={13}/></button><button aria-label={`Remove ${b.value}`} onClick={()=>removeBlock(b)} className="p-1 hover:text-rose-500 text-muted-foreground cursor-pointer"><Trash2 size={13}/></button></td>
              </tr>))}
            </tbody></table>
          </div>
        </div>
      </div>
    </div>
  )
}
