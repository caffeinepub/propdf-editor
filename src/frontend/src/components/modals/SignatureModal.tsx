import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "../../context/EditorContext";

export default function SignatureModal() {
  const { setShowSignatureModal, setSignatureDataUrl, setActiveTool } =
    useEditor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedName, setTypedName] = useState("");
  const lastPos = useRef({ x: 0, y: 0 });

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    clearCanvas();
  }, [clearCanvas]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    lastPos.current = getPos(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.strokeStyle = "#1e3a8a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const handleMouseUp = () => setIsDrawing(false);

  const saveDrawnSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setSignatureDataUrl(dataUrl);
    setActiveTool("signature");
    setShowSignatureModal(false);
  };

  const saveTypedSignature = () => {
    if (!typedName.trim()) return;
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "transparent";
    ctx.clearRect(0, 0, 400, 100);
    ctx.font = "italic 52px Georgia, serif";
    ctx.fillStyle = "#1e3a8a";
    ctx.textBaseline = "middle";
    ctx.fillText(typedName, 10, 55);
    const dataUrl = canvas.toDataURL("image/png");
    setSignatureDataUrl(dataUrl);
    setActiveTool("signature");
    setShowSignatureModal(false);
  };

  return (
    <Dialog open onOpenChange={() => setShowSignatureModal(false)}>
      <DialogContent data-ocid="signature.modal" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Signature</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="draw">
          <TabsList className="w-full">
            <TabsTrigger value="draw" className="flex-1">
              Draw
            </TabsTrigger>
            <TabsTrigger value="type" className="flex-1">
              Type
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="mt-4">
            <div className="border border-border rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                data-ocid="signature.canvas_target"
                width={450}
                height={150}
                className="w-full cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>
            <div className="flex justify-between mt-3">
              <Button variant="outline" size="sm" onClick={clearCanvas}>
                Clear
              </Button>
              <Button
                data-ocid="signature.save_button"
                size="sm"
                onClick={saveDrawnSignature}
              >
                Use Signature
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="type" className="mt-4">
            <div className="space-y-3">
              <div>
                <Label>Your Name</Label>
                <Input
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="Type your name..."
                  className="mt-1"
                />
              </div>
              {typedName && (
                <div className="border border-border rounded-lg p-4 bg-white">
                  <p
                    style={{
                      fontFamily: "Georgia, serif",
                      fontStyle: "italic",
                      fontSize: 36,
                      color: "#1e3a8a",
                    }}
                  >
                    {typedName}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-3">
              <Button
                data-ocid="signature.save_button"
                size="sm"
                onClick={saveTypedSignature}
                disabled={!typedName.trim()}
              >
                Use Signature
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowSignatureModal(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
