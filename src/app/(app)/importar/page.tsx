import { Importador } from "./importador";

export default function Importar() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Importar planilha de obra</h1>
        <p className="text-sm text-stone-600">
          Escolha a planilha &quot;Centro de Custos&quot; (.xlsx). O sistema lê as abas LANÇAMENTO, DADOS e BASE-CRONO GERAL e
          cria a obra com etapas, cronograma, apropriações, fornecedores e lançamentos. Nada é gravado antes de você confirmar.
        </p>
      </div>
      <Importador />
    </div>
  );
}
