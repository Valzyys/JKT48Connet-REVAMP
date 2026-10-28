import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUpRight, Check, Heart, LockKeyhole, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { gsap } from '@/lib/gsap';
import './donasika.css';

type Summary = { campaign: { is_open: boolean; starts_at: number | null; ends_at: number | null; server_time: number }; total_amount: number; donation_count: number; total_note: string; supporters: { name: string; message: string; amount: number; paid_at: number }[] };
type Invoice = { id: string; name: string; amount: number; donation_amount: number; gateway_adjustment: number; status: string; qr_image: string | null; expired_at: string; paid_at: number | null };
const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const date = (n: number) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short' }).format(new Date(n * 1000)) + ' WIB';
const STC = 'https://support.savethechildren.or.id/donasi-karhutla';
const DD = 'https://digital.dompetdhuafa.org/donasi/karhutla';
async function api<T>(path = '', options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api/donasika' + path, { ...options, credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message || 'Belum dapat tersambung. Coba kembali.'), { code: data.code });
  return data as T;
}

export function DonasikaPage() {
  const root = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<Summary | null>(null), [loadError, setLoadError] = useState('');
  const [amount, setAmount] = useState('25000'), [name, setName] = useState(''), [anonymous, setAnonymous] = useState(false), [message, setMessage] = useState('');
  const [invoice, setInvoice] = useState<Invoice | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [clock, setClock] = useState(Date.now()), offset = useRef(0), refreshing = useRef(false);
  const requestKey = useRef('');
  const isOpen = !!summary?.campaign.is_open && !!summary.campaign.ends_at && clock + offset.current < summary.campaign.ends_at * 1000;

  async function refresh() {
    if (refreshing.current) return;
    refreshing.current = true;
    try { const data = await api<Summary>(); offset.current = data.campaign.server_time * 1000 - Date.now(); setSummary(data); setLoadError(''); }
    catch (e) { setLoadError((e as Error).message); }
    finally { refreshing.current = false; }
  }
  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    const tick = window.setInterval(() => setClock(Date.now()), 1000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visible);
    try {
      requestKey.current = localStorage.getItem('donasika-request') || '';
      const id = localStorage.getItem('donasika-invoice');
      if (id && /^DK[A-F0-9]{20}$/.test(id)) void api<Invoice>('/payments/' + id).then(setInvoice).catch(() => {});
    } catch {}
    return () => { clearInterval(poll); clearInterval(tick); document.removeEventListener('visibilitychange', visible); };
  }, []);

  useEffect(() => {
    if (!invoice || !['PENDING', 'CREATING', 'REVIEW'].includes(invoice.status)) return;
    let stopped = false, timer: number;
    const check = async () => {
      try {
        const next = await api<Invoice>('/payments/' + invoice.id);
        if (stopped) return;
        setInvoice(next); setError('');
        if (next.status === 'SUCCESS') void refresh();
        if (['PENDING', 'CREATING', 'REVIEW'].includes(next.status)) timer = window.setTimeout(check, 15000);
      } catch (e) { if (!stopped) { setError((e as Error).message); timer = window.setTimeout(check, 25000); } }
    };
    timer = window.setTimeout(check, 15000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [invoice?.id, invoice?.status]);

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-dona-enter]', { y: 28, opacity: 0, duration: 0.9, stagger: 0.1, clearProps: 'all' });
      gsap.to('.dona-leaf', { y: -9, rotation: 5, duration: 3.5, stagger: 0.3, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    }, root);
    return () => ctx.revert();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !isOpen) return;
    setBusy(true); setError('');
    try {
      if (!requestKey.current) requestKey.current = crypto.randomUUID();
      try { localStorage.setItem('donasika-request', requestKey.current); } catch {}
      const next = await api<Invoice>('/payments', { method: 'POST', body: JSON.stringify({ amount: Number(amount), name, anonymous, message, request_key: requestKey.current }) });
      setInvoice(next);
      try { localStorage.setItem('donasika-invoice', next.id); } catch {}
    } catch (e) { setError((e as Error).message); if ((e as Error & { code?: string }).code === 'payment_rejected') { requestKey.current = ''; try { localStorage.removeItem('donasika-request'); } catch {} } }
    finally { setBusy(false); }
  }
  function reset() { setInvoice(null); setError(''); requestKey.current = ''; try { localStorage.removeItem('donasika-request'); localStorage.removeItem('donasika-invoice'); } catch {} }
  const remaining = summary?.campaign.ends_at ? Math.max(0, summary.campaign.ends_at * 1000 - clock - offset.current) : 0;
  const hours = Math.floor(remaining / 3600000), minutes = Math.floor(remaining / 60000) % 60;

  return <div className="donasika" ref={root}>
    <div className="dona-topline"><span>JKT48CONNECT / COMMUNITY CARE</span><span>01 — KARHUTLA</span></div>
    <section className="dona-hero">
      <div className="dona-intro">
        <p className="dona-eyebrow" data-dona-enter><span /> TUJUH HARI, SATU KEBAIKAN BERSAMA.</p>
        <h1 data-dona-enter>Dari kita,<br />untuk <em>napas</em><br />yang lebih lega<span>.</span></h1>
        <p className="dona-lede" data-dona-enter>Galangan kecil dari komunitas JKT48Connect untuk membantu anak dan keluarga terdampak kebakaran hutan dan lahan.</p>
        <a href="#ikut-bantu" className="dona-jump" data-dona-enter>Ikut bantu sekarang <ArrowDown size={17} /></a>
      </div>
      <div className="dona-art" aria-hidden="true">
        <span className="dona-art-index">A LITTLE CARE / A LITTLE AIR</span>
        <svg viewBox="0 0 440 420" role="presentation">
          <circle cx="302" cy="90" r="62" fill="#edd79b" />
          <path d="M0 330Q135 215 235 285T440 255V420H0Z" fill="#9ba989" />
          <path d="M0 380Q120 290 255 345T440 315V420H0Z" fill="#42604c" />
          <g stroke="#edeee0" strokeWidth="5" strokeLinecap="round" fill="none"><path d="M115 350Q102 230 152 128"/><path d="M115 275Q78 215 51 202"/><path d="M125 233Q189 214 209 180"/></g>
          <g fill="#cfdbb1"><path className="dona-leaf" d="M150 165Q103 120 163 65Q192 133 150 165Z"/><path className="dona-leaf" d="M95 261Q29 257 27 180Q94 190 95 261Z"/><path className="dona-leaf" d="M137 230Q153 161 230 161Q206 224 137 230Z"/></g>
          <g transform="translate(240 228) rotate(7)"><rect x="0" y="0" width="117" height="106" rx="32" fill="#f5edde"/><rect x="13" y="19" width="91" height="59" rx="22" fill="#182d28"/><path d="M31 50l9-8 9 8m20 0 9-8 9 8" fill="none" stroke="#f5edde" strokeWidth="5" strokeLinecap="round"/><path d="M18 94Q57 111 104 91l4 18Q56 130 15 111Z" fill="#d84643"/><path d="M99 108l15 31-23-5-8-23" fill="#d84643"/></g>
          <g fill="#f5edde"><path d="M54 80v18m-9-9h18M358 184v18m-9-9h18" stroke="#f5edde" strokeWidth="2"/><circle cx="61" cy="143" r="3"/><circle cx="378" cy="126" r="3"/></g>
        </svg>
        <div className="dona-art-stamp">Sama-sama<br /><strong>jaga sesama.</strong><Heart size={18} /></div>
      </div>
    </section>

    <section className="dona-meter" aria-label="Perkembangan donasi" data-dona-enter>
      <div className="dona-total"><p>DANA TERKONFIRMASI</p><strong>{summary ? rupiah(summary.total_amount) : 'Memuat…'}</strong><span>{summary?.donation_count ?? '—'} donasi terbayar · diperbarui otomatis</span></div>
      <div className="dona-time"><span className={'dona-status ' + (isOpen ? 'is-open' : '')}><i />{summary ? isOpen ? 'Penerimaan dibuka' : summary.campaign.starts_at ? 'Penerimaan ditutup' : 'Segera dibuka' : 'Memuat status'}</span><strong>{isOpen ? `${Math.floor(hours / 24)} hari · ${hours % 24}j ${minutes}m` : 'Terima kasih sudah peduli.'}</strong><span>{summary?.campaign.ends_at ? 'Ditutup ' + date(summary.campaign.ends_at) : 'Periode penggalangan: 7 hari'}</span></div>
    </section>
    {loadError && <div className="dona-error" role="alert">{loadError} <button onClick={() => void refresh()}>Muat ulang</button></div>}

    <div className="dona-main-grid">
      <div className="dona-story">
        <p className="dona-eyebrow">KENAPA KITA BERKUMPUL DI SINI</p>
        <h2>Oshi menyatukan kita.<br />Kepedulian membawa kita<br /><em>sedikit lebih jauh.</em></h2>
        <p>Di tengah kabut asap, ada keluarga yang perlu tetap menjalani hari. Lewat halaman ini, kita mengumpulkan bantuan bersama. Tidak harus besar; pilih nominal yang nyaman buatmu.</p>
        <div className="dona-destination"><span>RENCANA PENYALURAN</span><h3>Satu galangan.<br />Tujuan yang jelas.</h3><p>Setelah penggalangan ditutup, jika total akhir donasi terkonfirmasi mencapai <strong>Rp100.000 atau lebih</strong>, dana akan disalurkan melalui <a href={STC} target="_blank" rel="noreferrer">Save the Children Indonesia <ArrowUpRight size={13} /></a> untuk bantuan karhutla.</p><p>Jika totalnya <strong>di bawah Rp100.000</strong>, dana akan disalurkan melalui <a href={DD} target="_blank" rel="noreferrer">Dompet Dhuafa — bantuan karhutla <ArrowUpRight size={13} /></a>.</p><div className="dona-destination-now">Berdasarkan total saat ini: <strong>{(summary?.total_amount ?? 0) >= 100000 ? 'Save the Children Indonesia' : 'Dompet Dhuafa'}</strong></div><p className="dona-small">Penggalangan mandiri oleh JKT48Connect, bukan kampanye resmi atau pernyataan kemitraan dengan kedua lembaga. Status penyaluran saat ini: <strong>belum disalurkan</strong>.</p></div>
        <div className="dona-steps"><h3>Bantu dengan tenang.</h3>{[['01', 'Pilih nominal & tinggalkan pesan', 'Boleh memakai nama atau tampil sebagai Anonim. Pesan bersifat opsional dan tampil setelah pembayaran terkonfirmasi.'], ['02', 'Bayar lewat QRIS', 'Pindai dari mobile banking atau e-wallet. Status diperiksa otomatis; tidak perlu mengirim bukti transfer.'], ['03', 'Lihat perkembangan bersama', 'Total hanya menghitung donasi terbayar, sebelum potongan gateway bila ada. Penyesuaian nominal QRIS ditampilkan terpisah.']].map(([n, title, copy]) => <div key={n}><span>{n}</span><section><h4>{title}</h4><p>{copy}</p></section></div>)}</div>
      </div>

      <aside id="ikut-bantu" className="dona-form-wrap">
        <div className="dona-form-heading"><Heart size={20} /><span>SEDIKIT DARIMU, BERARTI.</span><span>↗</span></div>
        {!invoice ? <form onSubmit={submit} className="dona-form">
          <h2>Mau ikut bantu?</h2><p>Mulai dari Rp1.000. Setiap kebaikan punya tempat di sini.</p>
          <fieldset disabled={!isOpen || busy}><legend>Pilih nominal donasi</legend><div className="dona-amounts">{[10000, 25000, 50000, 100000].map(n => <button key={n} type="button" className={amount === String(n) ? 'selected' : ''} onClick={() => setAmount(String(n))}>{rupiah(n)}</button>)}</div><label htmlFor="dona-amount">Atau nominal lainnya</label><div className="dona-input-money"><span>Rp</span><input id="dona-amount" inputMode="numeric" type="number" min="1000" max="1000000" step="1" required value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <label htmlFor="dona-name">Nama untuk ditampilkan</label><input id="dona-name" autoComplete="name" maxLength={24} placeholder="Nama atau nama komunitasmu" value={name} onChange={e => setName(e.target.value)} required={!anonymous} disabled={anonymous} />
          <label className="dona-check"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} /><span>Tampilkan saya sebagai <strong>Anonim</strong></span></label>
          <label htmlFor="dona-message">Titip pesan <small>opsional</small></label><textarea id="dona-message" maxLength={280} rows={3} placeholder="Sebuah harapan kecil untuk mereka…" value={message} onChange={e => setMessage(e.target.value)} /><span className="dona-char">{message.length}/280 · pesan tampil di halaman publik</span>
          <button className="dona-submit" disabled={!isOpen || busy} type="submit">{busy ? 'Menyiapkan QRIS…' : isOpen ? 'Lanjutkan ke QRIS' : 'Penerimaan belum dibuka / sudah ditutup'}<ArrowUpRight size={19} /></button>
          </fieldset>
          <p className="dona-secure"><LockKeyhole size={13} /> Pembayaran terverifikasi otomatis · tanpa login</p>
        </form> : <div className="dona-invoice" aria-live="polite">
          {invoice.status === 'SUCCESS' ? <><span className="dona-success-icon"><Check /></span><h2>Kebaikanmu sudah sampai di galangan ini.</h2><p>Terima kasih, {invoice.name}. Donasi <strong>{rupiah(invoice.donation_amount)}</strong> sudah terkonfirmasi dan masuk ke total.</p><p className="dona-small">Dana masih dalam penggalangan, belum disalurkan ke lembaga penerima.</p><button className="dona-submit" onClick={reset}>Kembali ke halaman donasi <Heart size={17} /></button></> : <>
            <h2>{invoice.status === 'PENDING' && isOpen ? 'Satu langkah lagi.' : ['CREATING', 'REVIEW'].includes(invoice.status) ? 'Pembayaran sedang diperiksa.' : 'Tagihan telah berakhir.'}</h2>
            <p>{invoice.status === 'PENDING' && isOpen ? 'Pindai QRIS di bawah dan bayar sesuai nominal persis.' : ['CREATING', 'REVIEW'].includes(invoice.status) ? 'Jangan membayar ulang jika saldo sudah terpotong. Simpan kode tagihan di bawah untuk menghubungi pengelola.' : 'QRIS ini tidak ditampilkan lagi. Total donasi hanya berubah setelah pembayaran terkonfirmasi.'}</p>
            {invoice.qr_image && isOpen && <img className="dona-qr" src={invoice.qr_image} alt="QRIS pembayaran donasi" />}
            <strong className="dona-invoice-total">{rupiah(invoice.amount)}</strong><div className="dona-breakdown"><span>Nominal donasi <b>{rupiah(invoice.donation_amount)}</b></span><span>Penyesuaian gateway <b>{rupiah(invoice.gateway_adjustment)}</b></span></div>
            <p className="dona-small">Kode tagihan: <code>{invoice.id}</code><br />Status: {invoice.status}{invoice.expired_at && <><br />Batas QRIS dari gateway: {invoice.expired_at}</>}</p>
            {['PENDING', 'CREATING', 'REVIEW'].includes(invoice.status) ? <button className="dona-check-status" disabled={busy} onClick={async () => { setBusy(true); try { setInvoice(await api<Invoice>('/payments/' + invoice.id)); setError(''); void refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><RefreshCw size={15} />{busy ? 'Memeriksa…' : 'Cek status pembayaran'}</button> : <button className="dona-submit" onClick={reset}>Kembali <ArrowUpRight size={17} /></button>}
            <p className="dona-secure"><ShieldCheck size={14} /> Status dicek otomatis setiap 15 detik</p>
          </>}
        </div>}
        {error && <div className="dona-error" role="alert"><X size={15} />{error}</div>}
        <div className="dona-receipt-edge" aria-hidden="true" />
      </aside>
    </div>

    <section className="dona-wall"><div className="dona-wall-heading"><div><p className="dona-eyebrow">CATATAN KEBAIKAN</p><h2>Nama boleh disembunyikan.<br /><em>Kepedulian tetap terasa.</em></h2></div><span>{summary?.donation_count ?? 0} donasi terkonfirmasi</span></div>
      <div className="dona-wall-grid">{summary?.supporters.length ? summary.supporters.map((s, i) => <article key={`${s.paid_at}-${i}`}><div><span className="dona-avatar">{s.name ? s.name.slice(0, 1).toUpperCase() : '♡'}</span><strong>{s.name || 'Anonim'}</strong><span>{rupiah(s.amount)}</span></div>{s.message && <p>{s.message}</p>}<time dateTime={new Date(s.paid_at * 1000).toISOString()}>{date(s.paid_at)}</time></article>) : <div className="dona-empty"><Heart size={25} /><p>Ruang ini menunggu kebaikan pertama.</p><span>Nama dan pesan muncul setelah pembayaran dikonfirmasi.</span></div>}</div>
      <p className="dona-small">{summary?.total_note} Donatur anonim tidak ditampilkan namanya; pesan yang dipilih tetap bersifat publik. Jangan menyertakan nomor telepon atau informasi pribadi dalam pesan.</p>
    </section>
    <div className="dona-bottom-note"><span>JKT48CONNECT / DONASIKA</span><span>Terhubung oleh oshi. Bergerak karena peduli.</span></div>
  </div>;
}
