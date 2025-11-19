import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import Button from "@/components/landing/ui/Button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

const contactSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа"),
  email: z.string().email("Введите корректный email"),
  message: z.string().min(10, "Сообщение должно содержать минимум 10 символов")
});

type ContactFormData = z.infer<typeof contactSchema>;

const Contact = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      message: ""
    }
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log("Form data:", data);
    toast.success("Сообщение отправлено! Мы свяжемся с вами в ближайшее время.");
    form.reset();
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex flex-1 justify-center py-5 px-4 md:px-10 lg:px-20">
        <div className="flex w-full max-w-[1100px] flex-1 flex-col">
          <Header />
          
          <main className="py-12">
            <div className="grid lg:grid-cols-2 gap-12 animate-fade-in">
              {/* Left Column - Contact Info & Form */}
              <div className="space-y-8">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Связаться с нами
                  </h1>
                  <p className="text-muted-foreground text-lg">
                    Мы всегда готовы ответить на ваши вопросы и обсудить сотрудничество
                  </p>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3 glassmorphism rounded-xl p-4 border border-border/30">
                    <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <div className="font-semibold mb-1">Адрес</div>
                      <div className="text-sm text-muted-foreground">
                        123456, Москва, ул. Технологическая, д. 1, офис 101
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 glassmorphism rounded-xl p-4 border border-border/30">
                    <Phone className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <div className="font-semibold mb-1">Телефон</div>
                      <div className="text-sm text-muted-foreground">
                        +7 (495) 123-45-67
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 glassmorphism rounded-xl p-4 border border-border/30">
                    <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <div className="font-semibold mb-1">Email</div>
                      <div className="text-sm text-muted-foreground">
                        info@crssauto.ru
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Form */}
                <div className="glassmorphism rounded-2xl p-8 border border-border/30">
                  <h2 className="text-2xl font-bold mb-6">Оставьте ваше сообщение</h2>
                  
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ваше имя</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Иван Иванов" 
                                {...field}
                                className="bg-background/50 border-border/50"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ваш Email</FormLabel>
                            <FormControl>
                              <Input 
                                type="email"
                                placeholder="email@example.com" 
                                {...field}
                                className="bg-background/50 border-border/50"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Сообщение</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Введите ваше сообщение..."
                                className="min-h-[120px] bg-background/50 border-border/50 resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        fullWidth
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Отправка..." : "Отправить сообщение"}
                      </Button>
                    </form>
                  </Form>
                </div>
              </div>

              {/* Right Column - Map */}
              <div className="lg:sticky lg:top-24 h-fit">
                <div className="glassmorphism rounded-2xl border border-border/30 overflow-hidden h-[600px]">
                  <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center relative">
                    {/* Map placeholder with decorative elements */}
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute top-1/4 left-1/4 w-32 h-32 border-2 border-primary rounded-full"></div>
                      <div className="absolute bottom-1/3 right-1/3 w-24 h-24 border-2 border-primary rounded-full"></div>
                      <div className="absolute top-1/2 right-1/4 w-16 h-16 border-2 border-primary rounded-full"></div>
                    </div>
                    
                    <div className="relative z-10 text-center p-8">
                      <MapPin className="w-16 h-16 text-primary mx-auto mb-4" />
                      <p className="text-lg font-semibold mb-2">Наше расположение</p>
                      <p className="text-muted-foreground">
                        ул. Технологическая, д. 1<br />
                        Москва, 123456
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>

          <Footer />
        </div>
      </div>
    </div>
  );
};

export default Contact;
