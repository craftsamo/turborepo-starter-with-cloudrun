# Mapping Domain

How to map a custom domain to a deployed Cloud Run service.

## Creating a Zone in Cloudflare

1. Access [Cloudflare](https://dash.cloudflare.com/) and create an account.
2. Obtain/purchase a domain.
3. Create a zone for your domain in the Cloudflare dashboard
   (**Websites** > **Add a site** > enter your domain > select the **Free**
   plan).

## Verifying Domain Ownership

1. In [Google Search Console](https://search.google.com/search-console), add a
   new property. When prompted to choose a property type, select **Domain**
   (recommended — covers all subdomains) or **URL prefix**, then enter your
   domain.

2. Search Console displays a **TXT record** value for verification. Copy this
   value.

3. In Cloudflare, open **DNS** > **Records** and add a new TXT record:

   | Field    | Value                                  |
   | -------- | -------------------------------------- |
   | **Type** | `TXT`                                  |
   | **Name** | `@` (or the host specified by Search Console) |
   | **Content** | the copied TXT record value         |
   | **TTL**  | Auto                                   |

4. Return to Search Console and click **Verify**. DNS propagation may take a
   few minutes; once it resolves, ownership verification succeeds.

## Configuring the Mapping in Cloud Run

1. Open the
   [Cloud Run Domains](https://console.cloud.google.com/run/domains) page in
   the Google Cloud Console.

2. Click **Add Mapping** and select the verified custom domain.

3. Choose the Cloud Run service you want to map the domain to.

> [!NOTE]
>
> Leaving the subdomain field blank maps the domain to the origin (apex
> domain). Enter a subdomain (e.g., `www` or `dev`) to map to a subdomain
> instead.

4. A confirmation modal appears listing the DNS records that must be added to
   your DNS provider. Typically these include:

   - An **A record** pointing to Cloud Run's IP addresses (for the apex domain)
   - An **AAAA record** for IPv6 (if supported)
   - A **CNAME record** for any configured subdomain (e.g., `www`)

   Note the **Type**, **Name**, and **Value/Target** for each record shown in
   the modal.

5. In Cloudflare, add each record from the modal:

   | Field             | Value                                              |
   | ----------------- | -------------------------------------------------- |
   | **Type**          | as specified (A / AAAA / CNAME)                    |
   | **Name**          | the subdomain or `@` for the apex domain           |
   | **Target / Content** | the IP address or hostname from the modal       |
   | **Proxy status**  | DNS only (grey cloud) — recommended during setup   |

6. Return to the Cloud Run **Domain Mappings** page and wait for the status to
   change to **Completed**. This may take several minutes as the DNS changes
   propagate and Google provisions a managed SSL certificate for the domain.

Congratulations! A custom domain has been successfully mapped to the Cloud Run
service. Once the mapping is active and the certificate is ready, you may
enable Cloudflare's proxy (orange cloud) if desired.
