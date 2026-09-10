-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('ADMIN', 'FINANCEIRO', 'OPERACAO', 'MOTORISTA');

-- CreateEnum
CREATE TYPE "TipoVeiculo" AS ENUM ('CAVALO', 'TRUCK', 'CARRETA');

-- CreateEnum
CREATE TYPE "TipoPosse" AS ENUM ('PROPRIO', 'AGREGADO');

-- CreateEnum
CREATE TYPE "StatusVeiculo" AS ENUM ('ATIVO', 'MANUTENCAO', 'INATIVO', 'VENDIDO');

-- CreateEnum
CREATE TYPE "VinculoMotorista" AS ENUM ('CLT', 'AUTONOMO', 'AGREGADO');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "StatusViagem" AS ENUM ('PLANEJADA', 'EM_ANDAMENTO', 'AGUARDANDO_ACERTO', 'FECHADA');

-- CreateEnum
CREATE TYPE "ModalidadeFrete" AS ENUM ('FROTA_PROPRIA', 'AGREGADO');

-- CreateEnum
CREATE TYPE "FluxoFinanceiroAgregado" AS ENUM ('INTERMEDIADO', 'DIRETO');

-- CreateEnum
CREATE TYPE "StatusFrete" AS ENUM ('ABERTO', 'ENTREGUE', 'FATURADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoLancamento" AS ENUM ('RECEITA', 'DESPESA');

-- CreateEnum
CREATE TYPE "NivelCusto" AS ENUM ('DIRETO_VIAGEM', 'VEICULO', 'OVERHEAD');

-- CreateEnum
CREATE TYPE "StatusLancamento" AS ENUM ('ABERTO', 'PARCIAL', 'LIQUIDADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "GatilhoVencimento" AS ENUM ('DATA', 'AO_RECEBER');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'PIX', 'CHEQUE', 'BOLETO', 'CARTAO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "TipoManutencao" AS ENUM ('PREVENTIVA', 'CORRETIVA', 'PNEU', 'REVISAO');

-- CreateEnum
CREATE TYPE "OrigemDado" AS ENUM ('MANUAL', 'IMPORTADO');

-- CreateEnum
CREATE TYPE "TipoAcerto" AS ENUM ('MOTORISTA', 'AGREGADO');

-- CreateEnum
CREATE TYPE "ModeloRemuneracao" AS ENUM ('FIXO_MENSAL', 'COMISSAO', 'HIBRIDO');

-- CreateEnum
CREATE TYPE "BaseComissao" AS ENUM ('FRETE_REAL', 'VALOR_CTE');

-- CreateTable
CREATE TABLE "empresa" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "dataCorte" DATE NOT NULL,
    "configRateio" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL,
    "motoristaId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" TEXT,
    "contato" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "prazoPagamentoDias" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proprietario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "tipoPessoa" "TipoPessoa" NOT NULL,
    "contato" TEXT,
    "telefone" TEXT,
    "dadosBancarios" JSONB,
    "regraCobranca" JSONB NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proprietario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veiculo" (
    "id" TEXT NOT NULL,
    "apelido" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "tipo" "TipoVeiculo" NOT NULL,
    "tipoPosse" "TipoPosse" NOT NULL DEFAULT 'PROPRIO',
    "proprietarioId" TEXT,
    "marca" TEXT,
    "modelo" TEXT,
    "ano" INTEGER,
    "eixos" INTEGER,
    "tipoCarroceria" TEXT,
    "capacidadeKg" INTEGER,
    "capacidadeCabecas" INTEGER,
    "odometroAtual" INTEGER,
    "isentoIpva" BOOLEAN NOT NULL DEFAULT false,
    "isentoLicenciamento" BOOLEAN NOT NULL DEFAULT false,
    "dataAquisicao" DATE,
    "valorAquisicao" DECIMAL(14,2),
    "status" "StatusVeiculo" NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conjunto" (
    "id" TEXT NOT NULL,
    "cavaloId" TEXT NOT NULL,
    "carretaId" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motorista" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "cnh" TEXT,
    "cnhCategoria" TEXT,
    "cnhValidade" DATE,
    "telefone" TEXT,
    "vinculo" "VinculoMotorista" NOT NULL,
    "modeloRemuneracao" "ModeloRemuneracao" NOT NULL,
    "salarioFixo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "percentualComissao" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "baseComissao" "BaseComissao" NOT NULL DEFAULT 'FRETE_REAL',
    "valorDiaria" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "veiculoPadraoId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motorista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpfCnpj" TEXT,
    "tipoPessoa" "TipoPessoa",
    "categoria" TEXT,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conta_bancaria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "banco" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "saldoInicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dataSaldo" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conta_bancaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viagem" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "veiculoId" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "dataSaida" DATE NOT NULL,
    "dataChegada" DATE,
    "kmInicial" INTEGER NOT NULL,
    "kmFinal" INTEGER,
    "kmCarregado" INTEGER,
    "kmVazio" INTEGER,
    "kmImprodutivo" INTEGER,
    "motivoKmImprodutivo" TEXT,
    "origem" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "status" "StatusViagem" NOT NULL DEFAULT 'PLANEJADA',
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "viagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frete" (
    "id" TEXT NOT NULL,
    "viagemId" TEXT,
    "clienteId" TEXT NOT NULL,
    "modalidade" "ModalidadeFrete" NOT NULL DEFAULT 'FROTA_PROPRIA',
    "proprietarioId" TEXT,
    "fluxoFinanceiro" "FluxoFinanceiroAgregado",
    "numeroCte" TEXT,
    "serie" TEXT,
    "chaveCte" TEXT,
    "origem" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "produto" TEXT,
    "pesoKg" INTEGER,
    "cabecas" INTEGER,
    "valorCte" DECIMAL(14,2) NOT NULL,
    "valorFreteReal" DECIMAL(14,2) NOT NULL,
    "valorCargaNfe" DECIMAL(14,2),
    "numeroNfe" TEXT,
    "valorPedagioDestacado" DECIMAL(14,2),
    "valorIcms" DECIMAL(14,2),
    "outrasReceitas" DECIMAL(14,2),
    "valorComissaoAgregado" DECIMAL(14,2),
    "valorSeguroAgregado" DECIMAL(14,2),
    "cteComplementoDeId" TEXT,
    "dataEmissao" DATE NOT NULL,
    "dataColeta" DATE,
    "dataEntrega" DATE,
    "faturaId" TEXT,
    "status" "StatusFrete" NOT NULL DEFAULT 'ABERTO',
    "observacoes" TEXT,
    "origemDado" "OrigemDado" NOT NULL DEFAULT 'MANUAL',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "frete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abastecimento" (
    "id" TEXT NOT NULL,
    "veiculoId" TEXT NOT NULL,
    "viagemId" TEXT,
    "motoristaId" TEXT,
    "fornecedorId" TEXT,
    "data" DATE NOT NULL,
    "litros" DECIMAL(10,3) NOT NULL,
    "valorLitro" DECIMAL(10,4) NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "odometro" INTEGER NOT NULL,
    "tanqueCheio" BOOLEAN NOT NULL DEFAULT true,
    "origemDado" "OrigemDado" NOT NULL DEFAULT 'MANUAL',
    "lancamentoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abastecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manutencao" (
    "id" TEXT NOT NULL,
    "veiculoId" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "data" DATE NOT NULL,
    "odometro" INTEGER,
    "tipo" "TipoManutencao" NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorPecas" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorServico" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lancamentoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manutencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "nivelCusto" "NivelCusto" NOT NULL,
    "categoriaPaiId" TEXT,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamento" (
    "id" TEXT NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "valorPago" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dataCompetencia" DATE NOT NULL,
    "dataVencimento" DATE,
    "dataPagamento" DATE,
    "gatilhoVencimento" "GatilhoVencimento" NOT NULL DEFAULT 'DATA',
    "lancamentoOrigemId" TEXT,
    "veiculoId" TEXT,
    "viagemId" TEXT,
    "freteId" TEXT,
    "clienteId" TEXT,
    "fornecedorId" TEXT,
    "motoristaId" TEXT,
    "proprietarioId" TEXT,
    "formaPagamento" "FormaPagamento",
    "parcelamentoId" TEXT,
    "parcelaNumero" INTEGER,
    "parcelaTotal" INTEGER,
    "recorrenciaId" TEXT,
    "status" "StatusLancamento" NOT NULL DEFAULT 'ABERTO',
    "estornoDeId" TEXT,
    "observacoes" TEXT,
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baixa" (
    "id" TEXT NOT NULL,
    "lancamentoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "contaBancariaId" TEXT,
    "observacoes" TEXT,
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fatura" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "periodoInicio" DATE NOT NULL,
    "periodoFim" DATE NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "dataEmissao" DATE NOT NULL,
    "dataVencimento" DATE NOT NULL,
    "lancamentoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acerto" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAcerto" NOT NULL,
    "viagemId" TEXT,
    "motoristaId" TEXT,
    "proprietarioId" TEXT,
    "valorBruto" DECIMAL(14,2) NOT NULL,
    "adiantamentos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "descontos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "despesasReembolsadas" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorLiquido" DECIMAL(14,2) NOT NULL,
    "lancamentoId" TEXT,
    "fechadoEm" TIMESTAMP(3),
    "fechadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acerto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recorrencia" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "veiculoId" TEXT,
    "valor" DECIMAL(14,2) NOT NULL,
    "diaVencimento" INTEGER NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "parcelasTotal" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexo" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "mime" TEXT,
    "tamanhoBytes" INTEGER,
    "enviadoPor" TEXT,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "dadosAntes" JSONB,
    "dadosDepois" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_cnpj_key" ON "empresa"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_motoristaId_key" ON "usuario"("motoristaId");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_cnpj_key" ON "cliente"("cnpj");

-- CreateIndex
CREATE INDEX "cliente_ativo_idx" ON "cliente"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "proprietario_cpfCnpj_key" ON "proprietario"("cpfCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "veiculo_apelido_key" ON "veiculo"("apelido");

-- CreateIndex
CREATE UNIQUE INDEX "veiculo_placa_key" ON "veiculo"("placa");

-- CreateIndex
CREATE INDEX "veiculo_tipo_status_idx" ON "veiculo"("tipo", "status");

-- CreateIndex
CREATE INDEX "conjunto_cavaloId_inicio_idx" ON "conjunto"("cavaloId", "inicio");

-- CreateIndex
CREATE INDEX "conjunto_carretaId_inicio_idx" ON "conjunto"("carretaId", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "motorista_cpf_key" ON "motorista"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "fornecedor_cpfCnpj_key" ON "fornecedor"("cpfCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "viagem_numero_key" ON "viagem"("numero");

-- CreateIndex
CREATE INDEX "viagem_veiculoId_dataSaida_idx" ON "viagem"("veiculoId", "dataSaida");

-- CreateIndex
CREATE INDEX "viagem_status_idx" ON "viagem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "frete_chaveCte_key" ON "frete"("chaveCte");

-- CreateIndex
CREATE INDEX "frete_clienteId_dataEmissao_idx" ON "frete"("clienteId", "dataEmissao");

-- CreateIndex
CREATE INDEX "frete_modalidade_dataEmissao_idx" ON "frete"("modalidade", "dataEmissao");

-- CreateIndex
CREATE INDEX "frete_status_idx" ON "frete"("status");

-- CreateIndex
CREATE UNIQUE INDEX "abastecimento_lancamentoId_key" ON "abastecimento"("lancamentoId");

-- CreateIndex
CREATE INDEX "abastecimento_veiculoId_data_idx" ON "abastecimento"("veiculoId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "manutencao_lancamentoId_key" ON "manutencao"("lancamentoId");

-- CreateIndex
CREATE INDEX "manutencao_veiculoId_data_idx" ON "manutencao"("veiculoId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_nome_key" ON "categoria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "lancamento_estornoDeId_key" ON "lancamento"("estornoDeId");

-- CreateIndex
CREATE INDEX "lancamento_tipo_dataVencimento_idx" ON "lancamento"("tipo", "dataVencimento");

-- CreateIndex
CREATE INDEX "lancamento_dataCompetencia_idx" ON "lancamento"("dataCompetencia");

-- CreateIndex
CREATE INDEX "lancamento_status_dataVencimento_idx" ON "lancamento"("status", "dataVencimento");

-- CreateIndex
CREATE INDEX "lancamento_veiculoId_dataCompetencia_idx" ON "lancamento"("veiculoId", "dataCompetencia");

-- CreateIndex
CREATE INDEX "lancamento_parcelamentoId_idx" ON "lancamento"("parcelamentoId");

-- CreateIndex
CREATE INDEX "baixa_lancamentoId_idx" ON "baixa"("lancamentoId");

-- CreateIndex
CREATE INDEX "baixa_data_idx" ON "baixa"("data");

-- CreateIndex
CREATE UNIQUE INDEX "fatura_numero_key" ON "fatura"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "fatura_lancamentoId_key" ON "fatura"("lancamentoId");

-- CreateIndex
CREATE INDEX "fatura_clienteId_periodoInicio_idx" ON "fatura"("clienteId", "periodoInicio");

-- CreateIndex
CREATE UNIQUE INDEX "acerto_viagemId_key" ON "acerto"("viagemId");

-- CreateIndex
CREATE UNIQUE INDEX "acerto_lancamentoId_key" ON "acerto"("lancamentoId");

-- CreateIndex
CREATE INDEX "anexo_entidade_entidadeId_idx" ON "anexo"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "auditoria_entidade_entidadeId_idx" ON "auditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "auditoria_criadoEm_idx" ON "auditoria"("criadoEm");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veiculo" ADD CONSTRAINT "veiculo_proprietarioId_fkey" FOREIGN KEY ("proprietarioId") REFERENCES "proprietario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conjunto" ADD CONSTRAINT "conjunto_cavaloId_fkey" FOREIGN KEY ("cavaloId") REFERENCES "veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conjunto" ADD CONSTRAINT "conjunto_carretaId_fkey" FOREIGN KEY ("carretaId") REFERENCES "veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motorista" ADD CONSTRAINT "motorista_veiculoPadraoId_fkey" FOREIGN KEY ("veiculoPadraoId") REFERENCES "veiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viagem" ADD CONSTRAINT "viagem_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motorista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frete" ADD CONSTRAINT "frete_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "viagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frete" ADD CONSTRAINT "frete_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frete" ADD CONSTRAINT "frete_proprietarioId_fkey" FOREIGN KEY ("proprietarioId") REFERENCES "proprietario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frete" ADD CONSTRAINT "frete_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "fatura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frete" ADD CONSTRAINT "frete_cteComplementoDeId_fkey" FOREIGN KEY ("cteComplementoDeId") REFERENCES "frete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abastecimento" ADD CONSTRAINT "abastecimento_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abastecimento" ADD CONSTRAINT "abastecimento_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "viagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abastecimento" ADD CONSTRAINT "abastecimento_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abastecimento" ADD CONSTRAINT "abastecimento_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abastecimento" ADD CONSTRAINT "abastecimento_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manutencao" ADD CONSTRAINT "manutencao_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manutencao" ADD CONSTRAINT "manutencao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manutencao" ADD CONSTRAINT "manutencao_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_categoriaPaiId_fkey" FOREIGN KEY ("categoriaPaiId") REFERENCES "categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "viagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_freteId_fkey" FOREIGN KEY ("freteId") REFERENCES "frete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_proprietarioId_fkey" FOREIGN KEY ("proprietarioId") REFERENCES "proprietario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_recorrenciaId_fkey" FOREIGN KEY ("recorrenciaId") REFERENCES "recorrencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_lancamentoOrigemId_fkey" FOREIGN KEY ("lancamentoOrigemId") REFERENCES "lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento" ADD CONSTRAINT "lancamento_estornoDeId_fkey" FOREIGN KEY ("estornoDeId") REFERENCES "lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baixa" ADD CONSTRAINT "baixa_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "lancamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baixa" ADD CONSTRAINT "baixa_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "conta_bancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fatura" ADD CONSTRAINT "fatura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fatura" ADD CONSTRAINT "fatura_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acerto" ADD CONSTRAINT "acerto_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "viagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acerto" ADD CONSTRAINT "acerto_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acerto" ADD CONSTRAINT "acerto_proprietarioId_fkey" FOREIGN KEY ("proprietarioId") REFERENCES "proprietario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acerto" ADD CONSTRAINT "acerto_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recorrencia" ADD CONSTRAINT "recorrencia_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recorrencia" ADD CONSTRAINT "recorrencia_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
