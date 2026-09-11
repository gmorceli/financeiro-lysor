/**
 * Gerador de MDF-e de mentira, com a mesma estrutura dos de verdade.
 *
 * Os 28 arquivos reais de setembro não entram no repositório: têm CPF e CNPJ de
 * pessoas. O leitor foi conferido contra eles uma vez, à mão; o que fica
 * versionado é este gerador, que reproduz a forma do documento — inclusive as
 * duas armadilhas que quebraram a primeira versão do leitor: a chave de 44
 * dígitos, que vira notação científica se alguém deixar o parser converter
 * número, e o CPF com zero à esquerda.
 */
export function montarMdfe(d: {
  numero: string
  chaveMdfe: string
  chaveCte?: string | null
  dhEmi: string
  dhIniViagem?: string
  municipioCarga: string
  municipioDescarga: string
  placa: string
  placaReboque?: string
  motoristaNome: string
  motoristaCpf: string
  /** Presente só quando o caminhão é de terceiro. */
  proprietario?: { nome: string; doc: string; rntrc: string }
  pagadorNome: string
  pagadorDoc: string
  vContrato: number
  vCarga: number
  qCarga?: number
  produto?: string
  /** Para simular um manifesto com mais de um CT-e. */
  chavesExtras?: string[]
  modelo?: string
}): string {
  const doc = (v: string) => (v.length === 14 ? `<CNPJ>${v}</CNPJ>` : `<CPF>${v}</CPF>`)
  const chaves = [d.chaveCte, ...(d.chavesExtras ?? [])].filter(Boolean) as string[]
  return `<?xml version="1.0" encoding="UTF-8"?>
<mdfeProc xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">
<MDFe xmlns="http://www.portalfiscal.inf.br/mdfe">
<infMDFe Id="MDFe${d.chaveMdfe}" versao="3.00">
<ide><cUF>51</cUF><tpAmb>1</tpAmb><tpEmit>1</tpEmit><mod>${d.modelo ?? '58'}</mod><serie>1</serie>
<nMDF>${d.numero}</nMDF><modal>1</modal><dhEmi>${d.dhEmi}</dhEmi><tpEmis>1</tpEmis>
<UFIni>MT</UFIni><UFFim>MT</UFFim>
<infMunCarrega><cMunCarrega>5107800</cMunCarrega><xMunCarrega>${d.municipioCarga}</xMunCarrega></infMunCarrega>
<dhIniViagem>${d.dhIniViagem ?? d.dhEmi}</dhIniViagem></ide>
<emit><CNPJ>64500634000196</CNPJ><xNome>LYSOR TRANSPORTES LTDA</xNome></emit>
<infModal versaoModal="3.00"><rodo>
<infANTT><RNTRC>58929133</RNTRC>
<infPag><xNome>${d.pagadorNome}</xNome>${doc(d.pagadorDoc)}
<Comp><tpComp>04</tpComp><vComp>${d.vContrato.toFixed(2)}</vComp></Comp>
<vContrato>${d.vContrato.toFixed(2)}</vContrato><indPag>0</indPag></infPag></infANTT>
<veicTracao><cInt>1</cInt><placa>${d.placa}</placa><tara>23000</tara><capKG>0</capKG>
${d.proprietario ? `<prop>${doc(d.proprietario.doc)}<RNTRC>${d.proprietario.rntrc}</RNTRC><xNome>${d.proprietario.nome}</xNome><UF>MT</UF><tpProp>2</tpProp></prop>` : ''}
<condutor><xNome>${d.motoristaNome}</xNome><CPF>${d.motoristaCpf}</CPF></condutor>
<tpRod>03</tpRod><tpCar>00</tpCar><UF>MT</UF></veicTracao>
${d.placaReboque ? `<veicReboque><cInt>2</cInt><placa>${d.placaReboque}</placa><tara>25500</tara><capKG>0</capKG><tpCar>00</tpCar><UF>MT</UF></veicReboque>` : ''}
</rodo></infModal>
<infDoc><infMunDescarga><cMunDescarga>5106307</cMunDescarga><xMunDescarga>${d.municipioDescarga}</xMunDescarga>
${chaves.map((c) => `<infCTe><chCTe>${c}</chCTe></infCTe>`).join('')}
</infMunDescarga></infDoc>
<prodPred><tpCarga>05</tpCarga><xProd>${d.produto ?? 'BOVINO FEMEA ACIMA DE 36 MESES'}</xProd></prodPred>
<tot><qCTe>${chaves.length}</qCTe><qNFe>0</qNFe><vCarga>${d.vCarga.toFixed(2)}</vCarga><cUnid>01</cUnid><qCarga>${(d.qCarga ?? 6500).toFixed(4)}</qCarga></tot>
</infMDFe></MDFe></mdfeProc>`
}

/** Evento de encerramento: o emissor exporta junto, e o leitor deve ignorar. */
export function montarEventoEncerramento(chave: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<procEventoMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">
<eventoMDFe versao="3.00"><infEvento Id="ID1101325${chave}01">
<cOrgao>51</cOrgao><tpAmb>1</tpAmb><CNPJ>64500634000196</CNPJ><chMDFe>${chave}</chMDFe>
<dhEvento>2026-09-05T10:00:00-04:00</dhEvento><tpEvento>110132</tpEvento>
</infEvento></eventoMDFe></procEventoMDFe>`
}

/**
 * Chave de acesso de 44 dígitos, montada no layout oficial — porque é dele que
 * o leitor tira o número do documento, nas posições 26 a 34:
 *
 *     cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8) cDV(1)
 */
export function montarChave(modelo: '57' | '58', numero: number): string {
  const chave =
    '51' +
    '2609' +
    '64500634000196' +
    modelo +
    '001' +
    String(numero).padStart(9, '0') +
    '1' +
    String(numero).padStart(8, '0') +
    '0'
  if (chave.length !== 44) throw new Error(`chave com ${chave.length} dígitos`)
  return chave
}
