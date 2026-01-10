import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trash2, Plus, Calculator, Delete } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CalculationRow {
  id: string;
  amount: number | null;
}

const PercentCalculator = () => {
  const [rows7, setRows7] = useState<CalculationRow[]>([
    { id: crypto.randomUUID(), amount: null }
  ]);
  const [rows8, setRows8] = useState<CalculationRow[]>([
    { id: crypto.randomUUID(), amount: null }
  ]);

  // Состояние для обычного калькулятора
  const [calcDisplay, setCalcDisplay] = useState("0");
  const [calcPrevValue, setCalcPrevValue] = useState<number | null>(null);
  const [calcOperation, setCalcOperation] = useState<string | null>(null);
  const [calcWaitingForOperand, setCalcWaitingForOperand] = useState(false);

  const addRow = (type: "7" | "8") => {
    const newRow = { id: crypto.randomUUID(), amount: null };
    if (type === "7") {
      setRows7([...rows7, newRow]);
    } else {
      setRows8([...rows8, newRow]);
    }
  };

  const resetAll = () => {
    setRows7([{ id: crypto.randomUUID(), amount: null }]);
    setRows8([{ id: crypto.randomUUID(), amount: null }]);
  };

  const deleteRow = (type: "7" | "8", id: string) => {
    if (type === "7") {
      if (rows7.length > 1) {
        setRows7(rows7.filter(row => row.id !== id));
      }
    } else {
      if (rows8.length > 1) {
        setRows8(rows8.filter(row => row.id !== id));
      }
    }
  };

  const updateAmount = (type: "7" | "8", id: string, value: string) => {
    const numValue = value === "" ? null : parseFloat(value);
    if (type === "7") {
      setRows7(rows7.map(row => 
        row.id === id ? { ...row, amount: numValue } : row
      ));
    } else {
      setRows8(rows8.map(row => 
        row.id === id ? { ...row, amount: numValue } : row
      ));
    }
  };

  // Расчёт процента: сумма / 93 * 100 для 7%, сумма / 92 * 100 для 8%
  const calculatePercent = (amount: number | null, type: "7" | "8"): number => {
    if (amount === null || amount === 0) return 0;
    const divisor = type === "7" ? 93 : 92;
    return amount / divisor * 100;
  };

  const totals7 = useMemo(() => {
    const totalAmount = rows7.reduce((sum, row) => sum + (row.amount || 0), 0);
    const totalPercent = calculatePercent(totalAmount, "7");
    return { totalAmount, totalPercent };
  }, [rows7]);

  const totals8 = useMemo(() => {
    const totalAmount = rows8.reduce((sum, row) => sum + (row.amount || 0), 0);
    const totalPercent = calculatePercent(totalAmount, "8");
    return { totalAmount, totalPercent };
  }, [rows8]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Функции обычного калькулятора
  const calcClear = () => {
    setCalcDisplay("0");
    setCalcPrevValue(null);
    setCalcOperation(null);
    setCalcWaitingForOperand(false);
  };

  const calcInputDigit = (digit: string) => {
    if (calcWaitingForOperand) {
      setCalcDisplay(digit);
      setCalcWaitingForOperand(false);
    } else {
      setCalcDisplay(calcDisplay === "0" ? digit : calcDisplay + digit);
    }
  };

  const calcInputDot = () => {
    if (calcWaitingForOperand) {
      setCalcDisplay("0.");
      setCalcWaitingForOperand(false);
    } else if (!calcDisplay.includes(".")) {
      setCalcDisplay(calcDisplay + ".");
    }
  };

  const calcBackspace = () => {
    if (calcDisplay.length > 1) {
      setCalcDisplay(calcDisplay.slice(0, -1));
    } else {
      setCalcDisplay("0");
    }
  };

  const calcPerformOperation = (nextOperation: string) => {
    const inputValue = parseFloat(calcDisplay);

    if (calcPrevValue === null) {
      setCalcPrevValue(inputValue);
    } else if (calcOperation) {
      const currentValue = calcPrevValue || 0;
      let result = 0;

      switch (calcOperation) {
        case "+":
          result = currentValue + inputValue;
          break;
        case "-":
          result = currentValue - inputValue;
          break;
        case "×":
          result = currentValue * inputValue;
          break;
        case "÷":
          result = inputValue !== 0 ? currentValue / inputValue : 0;
          break;
        case "%":
          result = (currentValue * inputValue) / 100;
          break;
      }

      setCalcDisplay(String(result));
      setCalcPrevValue(result);
    }

    setCalcWaitingForOperand(true);
    setCalcOperation(nextOperation);
  };

  const calcEquals = () => {
    if (calcOperation === null || calcPrevValue === null) return;

    const inputValue = parseFloat(calcDisplay);
    let result = 0;

    switch (calcOperation) {
      case "+":
        result = calcPrevValue + inputValue;
        break;
      case "-":
        result = calcPrevValue - inputValue;
        break;
      case "×":
        result = calcPrevValue * inputValue;
        break;
      case "÷":
        result = inputValue !== 0 ? calcPrevValue / inputValue : 0;
        break;
      case "%":
        result = (calcPrevValue * inputValue) / 100;
        break;
    }

    setCalcDisplay(String(result));
    setCalcPrevValue(null);
    setCalcOperation(null);
    setCalcWaitingForOperand(true);
  };

  const CalcButton = ({ 
    onClick, 
    children, 
    variant = "default" 
  }: { 
    onClick: () => void; 
    children: React.ReactNode; 
    variant?: "default" | "operation" | "equals" | "clear";
  }) => {
    const baseClasses = "h-14 text-xl font-medium rounded-lg transition-all active:scale-95";
    const variantClasses = {
      default: "bg-muted hover:bg-muted/80 text-foreground",
      operation: "bg-primary/20 hover:bg-primary/30 text-primary",
      equals: "bg-primary hover:bg-primary/90 text-primary-foreground",
      clear: "bg-destructive/20 hover:bg-destructive/30 text-destructive"
    };

    return (
      <button 
        onClick={onClick}
        className={`${baseClasses} ${variantClasses[variant]}`}
      >
        {children}
      </button>
    );
  };

  const renderTable = (rows: CalculationRow[], type: "7" | "8", totals: { totalAmount: number; totalPercent: number }) => (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">№</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Сумма</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                Расчёт {type}% (/{type === "7" ? "93" : "92"}*100)
              </th>
              <th className="py-3 px-4 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2 px-4 text-muted-foreground">{index + 1}</td>
                <td className="py-2 px-4">
                  <Input
                    type="number"
                    value={row.amount ?? ""}
                    onChange={(e) => updateAmount(type, row.id, e.target.value)}
                    placeholder="0.00"
                    className="w-full max-w-[200px]"
                  />
                </td>
                <td className="py-2 px-4 font-mono text-primary">
                  {row.amount ? formatNumber(calculatePercent(row.amount, type)) : "—"}
                </td>
                <td className="py-2 px-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteRow(type, row.id)}
                    disabled={rows.length === 1}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/50 font-semibold">
              <td className="py-3 px-4">Итого</td>
              <td className="py-3 px-4 font-mono">
                {formatNumber(totals.totalAmount)}
              </td>
              <td className="py-3 px-4 font-mono text-primary">
                {formatNumber(totals.totalPercent)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Button
        variant="outline"
        onClick={() => addRow(type)}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Добавить строку
      </Button>
    </div>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Калькулятор</h1>
        </div>
        <Button variant="outline" onClick={resetAll} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Обнулить проценты
        </Button>
      </div>

      <Tabs defaultValue="calc" className="w-full">
        <TabsList className="grid w-full max-w-[500px] grid-cols-3">
          <TabsTrigger value="calc" className="gap-2">
            <Calculator className="h-4 w-4" />
            <span>Калькулятор</span>
          </TabsTrigger>
          <TabsTrigger value="7" className="gap-2">
            <span>7%</span>
            <span className="text-xs text-muted-foreground">(/93*100)</span>
          </TabsTrigger>
          <TabsTrigger value="8" className="gap-2">
            <span>8%</span>
            <span className="text-xs text-muted-foreground">(/92*100)</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calc" className="mt-6">
          <Card className="max-w-sm mx-auto">
            <CardHeader>
              <CardTitle className="text-lg">Обычный калькулятор</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Display */}
              <div className="bg-muted rounded-lg p-4">
                <div className="text-right text-3xl font-mono font-semibold truncate">
                  {calcDisplay}
                </div>
                {calcOperation && (
                  <div className="text-right text-sm text-muted-foreground mt-1">
                    {calcPrevValue} {calcOperation}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-4 gap-2">
                <CalcButton onClick={calcClear} variant="clear">C</CalcButton>
                <CalcButton onClick={calcBackspace} variant="clear">
                  <Delete className="h-5 w-5 mx-auto" />
                </CalcButton>
                <CalcButton onClick={() => calcPerformOperation("%")} variant="operation">%</CalcButton>
                <CalcButton onClick={() => calcPerformOperation("÷")} variant="operation">÷</CalcButton>

                <CalcButton onClick={() => calcInputDigit("7")}>7</CalcButton>
                <CalcButton onClick={() => calcInputDigit("8")}>8</CalcButton>
                <CalcButton onClick={() => calcInputDigit("9")}>9</CalcButton>
                <CalcButton onClick={() => calcPerformOperation("×")} variant="operation">×</CalcButton>

                <CalcButton onClick={() => calcInputDigit("4")}>4</CalcButton>
                <CalcButton onClick={() => calcInputDigit("5")}>5</CalcButton>
                <CalcButton onClick={() => calcInputDigit("6")}>6</CalcButton>
                <CalcButton onClick={() => calcPerformOperation("-")} variant="operation">−</CalcButton>

                <CalcButton onClick={() => calcInputDigit("1")}>1</CalcButton>
                <CalcButton onClick={() => calcInputDigit("2")}>2</CalcButton>
                <CalcButton onClick={() => calcInputDigit("3")}>3</CalcButton>
                <CalcButton onClick={() => calcPerformOperation("+")} variant="operation">+</CalcButton>

                <CalcButton onClick={() => calcInputDigit("00")}>00</CalcButton>
                <CalcButton onClick={() => calcInputDigit("0")}>0</CalcButton>
                <CalcButton onClick={calcInputDot}>.</CalcButton>
                <CalcButton onClick={calcEquals} variant="equals">=</CalcButton>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="7" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Расчёт 7% (формула: сумма / 93 * 100)</CardTitle>
            </CardHeader>
            <CardContent>
              {renderTable(rows7, "7", totals7)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="8" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Расчёт 8% (формула: сумма / 92 * 100)</CardTitle>
            </CardHeader>
            <CardContent>
              {renderTable(rows8, "8", totals8)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Сводка по обоим разделам */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Общая сводка по процентам</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="text-sm text-muted-foreground">Раздел 7%</div>
              <div className="flex justify-between items-center">
                <span>Сумма:</span>
                <span className="font-mono font-semibold">{formatNumber(totals7.totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Расчёт 7%:</span>
                <span className="font-mono font-semibold text-primary">{formatNumber(totals7.totalPercent)}</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="text-sm text-muted-foreground">Раздел 8%</div>
              <div className="flex justify-between items-center">
                <span>Сумма:</span>
                <span className="font-mono font-semibold">{formatNumber(totals8.totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Расчёт 8%:</span>
                <span className="font-mono font-semibold text-primary">{formatNumber(totals8.totalPercent)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Общий итог расчётов:</span>
              <span className="font-mono text-primary">
                {formatNumber(totals7.totalPercent + totals8.totalPercent)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PercentCalculator;
