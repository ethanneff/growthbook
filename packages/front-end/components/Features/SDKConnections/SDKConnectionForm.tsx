import {
  CreateSDKConnectionParams,
  SDKConnectionInterface,
} from "back-end/types/sdk-connection";
import { useForm } from "react-hook-form";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useGrowthBook } from "@growthbook/growthbook-react";
import {
  FaCheck,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaInfoCircle,
} from "react-icons/fa";
import clsx from "clsx";
import { useDefinitions } from "@/services/DefinitionsContext";
import { useEnvironments } from "@/services/features";
import Modal from "@/components/Modal";
import { useAuth } from "@/services/auth";
import Field from "@/components/Forms/Field";
import SelectField from "@/components/Forms/SelectField";
import UpgradeModal from "@/components/Settings/UpgradeModal";
import Toggle from "@/components/Forms/Toggle";
import { isCloud } from "@/services/env";
import track from "@/services/track";
import Tooltip from "@/components/Tooltip/Tooltip";
import { useUser } from "@/services/UserContext";
import PremiumTooltip from "@/components/Marketing/PremiumTooltip";
import ControlledTabs from "@/components/Tabs/ControlledTabs";
import Tab from "@/components/Tabs/Tab";
import SDKLanguageSelector from "./SDKLanguageSelector";
import SDKLanguageLogo, { languageMapping } from "./SDKLanguageLogo";

function getSecurityTabState(
  value: Partial<SDKConnectionInterface>
): "none" | "client" | "server" {
  if (value.remoteEvalEnabled) return "server";
  if (value.encryptPayload || value.hashSecureAttributes) return "client";
  return "none";
}

export default function SDKConnectionForm({
  initialValue = {},
  edit,
  close,
  mutate,
}: {
  initialValue?: Partial<SDKConnectionInterface>;
  edit: boolean;
  close: () => void;
  mutate: () => void;
}) {
  const environments = useEnvironments();
  const { project, projects, getProjectById } = useDefinitions();
  const { apiCall } = useAuth();
  const router = useRouter();

  const { hasCommercialFeature } = useUser();

  const hasEncryptionFeature = hasCommercialFeature(
    "encrypt-features-endpoint"
  );
  const hasSecureAttributesFeature = hasCommercialFeature(
    "hash-secure-attributes"
  );
  const hasRemoteEvaluationFeature = hasCommercialFeature("remote-evaluation");

  useEffect(() => {
    if (edit) return;
    track("View SDK Connection Form");
  }, [edit]);

  const gb = useGrowthBook();

  const [selectedSecurityTab, setSelectedSecurityTab] = useState<string | null>(
    getSecurityTabState(initialValue)
  );
  const [upgradeModal, setUpgradeModal] = useState(false);

  const form = useForm({
    defaultValues: {
      name: initialValue.name ?? "",
      languages: initialValue.languages ?? [],
      environment: initialValue.environment ?? environments[0]?.id ?? "",
      project: "project" in initialValue ? initialValue.project : project ?? "",
      encryptPayload: initialValue.encryptPayload ?? false,
      hashSecureAttributes:
        initialValue.hashSecureAttributes ?? hasSecureAttributesFeature,
      includeVisualExperiments: initialValue.includeVisualExperiments ?? false,
      includeDraftExperiments: initialValue.includeDraftExperiments ?? false,
      includeExperimentNames: initialValue.includeExperimentNames ?? false,
      proxyEnabled: initialValue.proxy?.enabled ?? false,
      proxyHost: initialValue.proxy?.host ?? "",
      remoteEvalEnabled: initialValue.remoteEvalEnabled ?? false,
    },
  });

  const languages = form.watch("languages");

  const selectedLanguagesWithoutRemoteEvalSupport = languages.filter(
    (l) => !languageMapping[l].supportsRemoteEval
  );

  const selectedLanguagesWithoutEncryptionSupport = languages.filter(
    (l) => !languageMapping[l].supportsEncryption
  );

  const enableRemoteEval =
    hasRemoteEvaluationFeature &&
    !!gb?.isOn("remote-evaluation") &&
    selectedLanguagesWithoutRemoteEvalSupport.length === 0;

  const showVisualEditorSettings =
    !languages.length ||
    languages.some((l) => languageMapping[l].supportsVisualExperiments);

  const projectsOptions = projects.map((p) => ({
    label: p.name,
    value: p.id,
  }));
  const projectId = initialValue.project;
  const projectName = projectId
    ? getProjectById(projectId)?.name || null
    : null;
  const projectIsDeReferenced = projectId && !projectName;
  if (projectIsDeReferenced) {
    projectsOptions.push({
      label: "Invalid project",
      value: projectId,
    });
  }

  // complex setter for clicking a "SDK Payload Security" button
  useEffect(() => {
    if (selectedSecurityTab === "none") {
      form.setValue("remoteEvalEnabled", false);
      form.setValue("encryptPayload", false);
      form.setValue("hashSecureAttributes", false);
    } else if (selectedSecurityTab === "client") {
      const enableEncryption = hasEncryptionFeature;
      const enableSecureAttributes = hasSecureAttributesFeature;
      if (!enableEncryption && !enableSecureAttributes) return;
      form.setValue("remoteEvalEnabled", false);
      form.setValue("encryptPayload", enableEncryption);
      form.setValue("hashSecureAttributes", enableSecureAttributes);
    } else if (selectedSecurityTab === "server") {
      if (!enableRemoteEval) {
        form.setValue("remoteEvalEnabled", false);
        return;
      }
      form.setValue("remoteEvalEnabled", true);
      form.setValue("encryptPayload", false);
      form.setValue("hashSecureAttributes", false);
    }
  }, [
    selectedSecurityTab,
    setSelectedSecurityTab,
    initialValue,
    form,
    gb,
    hasEncryptionFeature,
    hasSecureAttributesFeature,
    hasRemoteEvaluationFeature,
    enableRemoteEval,
  ]);

  if (upgradeModal) {
    return (
      <UpgradeModal
        close={() => setUpgradeModal(false)}
        reason="To enable SDK encryption,"
        source="encrypt-features-endpoint"
      />
    );
  }

  return (
    <Modal
      header={edit ? "Edit SDK Connection" : "New SDK Connection"}
      size={"lg"}
      submit={form.handleSubmit(async (value) => {
        // filter for visual experiments
        if (
          languages.every((l) => !languageMapping[l].supportsVisualExperiments)
        ) {
          value.includeVisualExperiments = false;
        }
        if (!value.includeVisualExperiments) {
          value.includeDraftExperiments = false;
        }

        // filter for remote eval
        if (languages.every((l) => !languageMapping[l].supportsRemoteEval)) {
          value.remoteEvalEnabled = false;
        }

        const body: Omit<CreateSDKConnectionParams, "organization"> = {
          ...value,
          project: value.project || "",
        };

        if (edit) {
          await apiCall(`/sdk-connections/${initialValue.id}`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
          mutate();
        } else {
          const res = await apiCall<{ connection: SDKConnectionInterface }>(
            `/sdk-connections`,
            {
              method: "POST",
              body: JSON.stringify(body),
            }
          );
          track("Create SDK Connection", {
            source: "SDKConnectionForm",
            languages: value.languages,
            encryptPayload: value.encryptPayload,
            hashSecureAttributes: value.hashSecureAttributes,
            remoteEvalEnabled: value.remoteEvalEnabled,
            proxyEnabled: value.proxyEnabled,
          });
          mutate();
          await router.push(`/sdks/${res.connection.id}`);
        }
      })}
      close={close}
      open={true}
      cta="Save"
    >
      <div className="px-2">
        <Field label="Name" {...form.register("name")} required />

        <div className="form-group">
          <label>Tech Stack</label>
          <small className="text-muted ml-3">(Select all that apply)</small>
          <SDKLanguageSelector
            value={form.watch("languages")}
            setValue={(languages) => form.setValue("languages", languages)}
            multiple={true}
            includeOther={true}
          />
          <small className="form-text text-muted">
            This helps us give you personalized setup instructions
          </small>
        </div>

        <div className="row">
          {(projects.length > 0 || projectIsDeReferenced) && (
            <div className="col">
              <SelectField
                label="Project"
                initialOption="All Projects"
                value={form.watch("project") || ""}
                onChange={(project) => form.setValue("project", project)}
                options={projectsOptions}
                sort={false}
                formatOptionLabel={({ value, label }) => {
                  if (value === "") {
                    return <em>{label}</em>;
                  }
                  if (value === projectId && projectIsDeReferenced) {
                    return (
                      <Tooltip
                        body={
                          <>
                            Project <code>{value}</code> not found
                          </>
                        }
                      >
                        <span className="text-danger">
                          <FaExclamationTriangle /> <code>{value}</code>
                        </span>
                      </Tooltip>
                    );
                  }
                  return label;
                }}
              />
            </div>
          )}

          <div className="col">
            <SelectField
              label="Environment"
              required
              placeholder="Choose one..."
              value={form.watch("environment")}
              onChange={(env) => form.setValue("environment", env)}
              options={environments.map((e) => ({ label: e.id, value: e.id }))}
            />
          </div>
        </div>

        <label>SDK Payload Security</label>
        <div className="border rounded pt-3 px-3 mb-4 bg-light">
          <ControlledTabs
            newStyle={true}
            className="mb-3"
            buttonsWrapperClassName="sdk-security-button-wrapper mb-3"
            buttonsClassName={(tab) =>
              clsx("sdk-security-button text-center border rounded", {
                selected: tab === getSecurityTabState(form.getValues()),
              })
            }
            tabContentsClassName={(tab) =>
              tab === "none" ? "d-none" : "noborder"
            }
            setActive={setSelectedSecurityTab}
            active={selectedSecurityTab}
          >
            <Tab
              id="none"
              padding={false}
              className="pt-1 pb-2"
              display={
                <>
                  {getSecurityTabState(form.getValues()) === "none" && (
                    <>
                      <FaCheck className="check text-success" />{" "}
                    </>
                  )}
                  Plain Text
                  <Tooltip
                    popperClassName="text-left"
                    body={
                      <p className="mb-0">
                        Full feature definitions, including targeting conditions
                        and experiment variations, are viewable by anyone with
                        the Client Key. Best for server-side SDKs.
                      </p>
                    }
                  >
                    <div className="subtitle">
                      Extremely fast and cacheable
                      <FaInfoCircle className="ml-1" />
                    </div>
                  </Tooltip>
                </>
              }
            >
              <></>
            </Tab>

            <Tab
              id="client"
              padding={false}
              className="pt-1 pb-2"
              display={
                <>
                  {getSecurityTabState(form.getValues()) === "client" && (
                    <>
                      <FaCheck className="check text-success" />{" "}
                    </>
                  )}
                  Ciphered
                  <Tooltip
                    popperClassName="text-left"
                    body={
                      <p className="mb-0">
                        Full feature definitions are encrypted and sensitive
                        targeting conditions are hashed to help avoid leaking
                        business logic to client-side apps. Not 100% safe, but
                        will stop most prying eyes.
                      </p>
                    }
                  >
                    <div className="subtitle">
                      Good mix of performance and security
                      <FaInfoCircle className="ml-1" />
                    </div>
                  </Tooltip>
                </>
              }
            >
              <div className="d-flex">
                <div className="col-4">
                  <label htmlFor="encryptSDK">
                    <PremiumTooltip
                      commercialFeature="encrypt-features-endpoint"
                      body={
                        <>
                          <p>
                            SDK payloads will be encrypted via the AES
                            encryption algorithm. When evaluating feature flags
                            in a public or insecure environment (such as a
                            browser), encryption provides an additional layer of
                            security through obfuscation. This allows you to
                            target users based on sensitive attributes.
                          </p>
                          <p className="mb-0 text-warning-orange small">
                            <FaExclamationCircle /> When using an insecure
                            environment, do not rely exclusively on payload
                            encryption as a means of securing highly sensitive
                            data. Because the client performs the decryption,
                            the unencrypted payload may be extracted with
                            sufficient effort.
                          </p>
                        </>
                      }
                    >
                      Encrypt SDK payload <FaInfoCircle />
                    </PremiumTooltip>
                  </label>
                  <div>
                    <Toggle
                      id="encryptSDK"
                      value={form.watch("encryptPayload")}
                      setValue={(val) => form.setValue("encryptPayload", val)}
                      disabled={!hasEncryptionFeature}
                    />
                  </div>
                </div>

                <div className="col-4">
                  <label htmlFor="hash-secure-attributes">
                    <PremiumTooltip
                      commercialFeature="hash-secure-attributes"
                      body={
                        <>
                          <p>
                            Feature targeting conditions referencing{" "}
                            <code>secureString</code> attributes will be
                            anonymized via SHA-256 hashing. When evaluating
                            feature flags in a public or insecure environment
                            (such as a browser), hashing provides an additional
                            layer of security through obfuscation. This allows
                            you to target users based on sensitive attributes.
                          </p>
                          <p className="mb-0 text-warning-orange small">
                            <FaExclamationCircle /> When using an insecure
                            environment, do not rely exclusively on hashing as a
                            means of securing highly sensitive data. Hashing is
                            an obfuscation technique that makes it very
                            difficult, but not impossible, to extract sensitive
                            data.
                          </p>
                        </>
                      }
                    >
                      Hash secure attributes <FaInfoCircle />
                    </PremiumTooltip>
                  </label>
                  <div>
                    <Toggle
                      id="hash-secure-attributes"
                      value={form.watch("hashSecureAttributes")}
                      setValue={(val) =>
                        form.setValue("hashSecureAttributes", val)
                      }
                      disabled={!hasSecureAttributesFeature}
                    />
                  </div>
                </div>
              </div>

              {form.watch("encryptPayload") &&
                selectedLanguagesWithoutEncryptionSupport.length > 0 && (
                  <div
                    className="ml-2 mt-3 text-warning-orange small"
                    style={{ marginBottom: -5 }}
                  >
                    <FaExclamationCircle /> Payload decryption is not natively
                    supported in the selected SDK
                    {selectedLanguagesWithoutEncryptionSupport.length === 1
                      ? ""
                      : "s"}
                    :
                    <div className="ml-2 mt-1">
                      {selectedLanguagesWithoutEncryptionSupport.map(
                        (id, i) => (
                          <span className="nowrap" key={id}>
                            <SDKLanguageLogo language={id} size={14} />
                            <span
                              className="text-muted font-weight-bold"
                              style={{ marginLeft: 2, verticalAlign: 3 }}
                            >
                              {languageMapping[id].label}
                            </span>
                            {i <
                              selectedLanguagesWithoutEncryptionSupport.length -
                                1 && ", "}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}
            </Tab>

            <Tab
              id="server"
              padding={false}
              className="pt-1 pb-2"
              display={
                <>
                  {getSecurityTabState(form.getValues()) === "server" && (
                    <>
                      <FaCheck className="check text-success" />{" "}
                    </>
                  )}
                  Remote Evaluated
                  <div
                    className="position-absolute badge badge-purple text-uppercase"
                    style={{ right: 5, top: 5 }}
                  >
                    Beta
                  </div>
                  <Tooltip
                    popperClassName="text-left"
                    body={
                      <>
                        <p className="mb-0">
                          Features and experiments are evaluated on{" "}
                          {isCloud()
                            ? "our Cloud CDN"
                            : "your GrowthBook Proxy server"}{" "}
                          and only the final assigned values are exposed to
                          users.
                        </p>
                        {!isCloud() && (
                          <div className="mt-2 text-warning-orange">
                            <FaExclamationCircle /> Requires a GrowthBook Proxy
                            server to be configured for self-hosted users
                          </div>
                        )}
                      </>
                    }
                  >
                    <div className="subtitle">
                      Completely hides business logic from users
                      <FaInfoCircle className="ml-1" />
                    </div>
                  </Tooltip>
                </>
              }
            >
              <div className="d-flex">
                <div className="col">
                  <label htmlFor="remote-evaluation">
                    <PremiumTooltip
                      commercialFeature="remote-evaluation"
                      tipMinWidth="600px"
                      body={
                        <>
                          <p>
                            <strong>Remote Evaluation</strong> fully secures
                            your SDK by evaluating feature flags exclusively on
                            a private server instead of within a front-end
                            environment. This ensures that any sensitive
                            information within targeting rules or unused feature
                            variations are never seen by the client. When used
                            in a front-end context, server side evaluation
                            provides the same benefits as a backend SDK.
                            However, this feature is not needed in a backend
                            context and is not supported.
                          </p>
                          <p>
                            Remote evaluation does come with a few cost
                            considerations:
                            <ol className="pl-3 mt-2">
                              <li className="mb-2">
                                It will increase network traffic. Evaluated
                                payloads cannot be shared across different
                                users; therefore CDN cache misses will increase.
                              </li>
                              <li>
                                Any connections using Streaming Updates will
                                incur a slight delay. An additional network hop
                                is required to retrieve the evaluated payload
                                from the server.
                              </li>
                            </ol>
                          </p>
                          <div className="mt-4" style={{ lineHeight: 1.2 }}>
                            <p className="mb-0">
                              <span className="badge badge-purple text-uppercase mr-2">
                                Beta
                              </span>
                              <span className="text-purple">
                                This is an opt-in beta feature.
                              </span>
                            </p>
                          </div>
                        </>
                      }
                    >
                      Use remote evaluation <FaInfoCircle />{" "}
                      <span className="badge badge-purple text-uppercase mr-2">
                        Beta
                      </span>
                    </PremiumTooltip>
                  </label>
                  <div className="row">
                    <div className="col d-flex align-items-center">
                      {gb?.isOn("remote-evaluation") ? (
                        <>
                          <Toggle
                            id="remote-evaluation"
                            value={form.watch("remoteEvalEnabled")}
                            setValue={(val) => {
                              if (
                                selectedLanguagesWithoutRemoteEvalSupport.length >
                                0
                              ) {
                                form.setValue("remoteEvalEnabled", false);
                              } else {
                                form.setValue("remoteEvalEnabled", val);
                              }
                            }}
                            disabled={
                              !hasRemoteEvaluationFeature ||
                              selectedLanguagesWithoutRemoteEvalSupport.length >
                                0
                            }
                          />
                          {isCloud() ? (
                            <div className="alert alert-info mb-0 ml-3 py-1 px-2">
                              <FaExclamationCircle className="mr-1" />
                              Cloud customers must self-host a remote evaluation
                              service such as{" "}
                              <a
                                target="_blank"
                                href="https://github.com/growthbook/growthbook-proxy"
                                rel="noreferrer"
                              >
                                GrowthBook Proxy
                              </a>{" "}
                              or a CDN edge worker.
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <Toggle
                            id="remote-evaluation"
                            value={false}
                            disabled={true}
                            setValue={() => {
                              return;
                            }}
                          />
                          <span className="text-muted ml-2">Coming soon</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {gb?.isOn("remote-evaluation") &&
              selectedLanguagesWithoutRemoteEvalSupport.length > 0 ? (
                <div
                  className="ml-2 mt-3 text-warning-orange small"
                  style={{ marginBottom: -5 }}
                >
                  <FaExclamationCircle /> Remote evaluation is currently only
                  supported in a subset of front-end SDKs. It is not supported
                  in the selected SDK
                  {selectedLanguagesWithoutRemoteEvalSupport.length === 1
                    ? ""
                    : "s"}
                  :
                  <div className="ml-2 mt-1">
                    {selectedLanguagesWithoutRemoteEvalSupport.map((id, i) => (
                      <span className="nowrap" key={id}>
                        <SDKLanguageLogo language={id} size={14} />
                        <span
                          className="text-muted font-weight-bold"
                          style={{ marginLeft: 2, verticalAlign: 3 }}
                        >
                          {languageMapping[id].label}
                        </span>
                        {i <
                          selectedLanguagesWithoutRemoteEvalSupport.length -
                            1 && ", "}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </Tab>
          </ControlledTabs>
        </div>

        {showVisualEditorSettings && (
          <>
            <label>Visual experiments</label>
            <div className="border rounded pt-2 pb-3 px-3 bg-light">
              <div>
                <label htmlFor="sdk-connection-visual-experiments-toggle">
                  Include visual experiments in endpoint&apos;s response?
                </label>
                <div className="form-inline">
                  <Toggle
                    id="sdk-connection-visual-experiments-toggle"
                    value={form.watch("includeVisualExperiments")}
                    setValue={(val) =>
                      form.setValue("includeVisualExperiments", val)
                    }
                  />
                </div>
              </div>
              {form.watch("includeVisualExperiments") && (
                <>
                  <div className="mt-3">
                    <Tooltip
                      body={
                        <>
                          <p>
                            In-development visual experiments will be sent to
                            the SDK. We recommend only enabling this for
                            non-production environments.
                          </p>
                          <p className="mb-0">
                            To force into a variation, use a URL query string
                            such as{" "}
                            <code className="d-block">?my-experiment-id=2</code>
                          </p>
                        </>
                      }
                    >
                      <label htmlFor="sdk-connection-include-draft-experiments-toggle">
                        Include draft experiments <FaInfoCircle />
                      </label>
                    </Tooltip>
                    <div>
                      <Toggle
                        id="sdk-connection-include-draft-experiments-toggle"
                        value={form.watch("includeDraftExperiments")}
                        setValue={(val) =>
                          form.setValue("includeDraftExperiments", val)
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <div className="mt-3 mb-3">
          <Tooltip
            body={
              <>
                <p>
                  This can help add context when debugging or tracking events.
                </p>
                <div>
                  However, this could expose potentially sensitive information
                  to your users if enabled for a client-side or mobile
                  application.
                </div>
              </>
            }
          >
            <label htmlFor="sdk-connection-include-experiment-meta">
              Include experiment/variation names? <FaInfoCircle />
            </label>
          </Tooltip>
          <div>
            <Toggle
              id="sdk-connection-include-experiment-meta"
              value={form.watch("includeExperimentNames")}
              setValue={(val) => form.setValue("includeExperimentNames", val)}
            />
          </div>
        </div>

        {isCloud() && gb?.isOn("proxy-cloud") && (
          <div
            className="d-flex mt-3 mb-3 align-top"
            style={{ justifyContent: "space-between" }}
          >
            <div className="">
              <label htmlFor="sdk-connection-proxy-toggle">
                Use GrowthBook Proxy
              </label>
              <div>
                <Toggle
                  id="sdk-connection-proxy-toggle"
                  value={form.watch("proxyEnabled")}
                  setValue={(val) => form.setValue("proxyEnabled", val)}
                />
              </div>
            </div>

            {form.watch("proxyEnabled") && (
              <div className="ml-3 d-flex align-items-center">
                <label
                  className="mr-2 mt-3 pt-2"
                  htmlFor="sdk-connection-proxyHost"
                >
                  Proxy Host URL
                </label>
                <Field
                  id="sdk-connection-proxyHost"
                  required
                  placeholder="https://"
                  type="url"
                  containerClassName="mt-3"
                  style={{ width: 400 }}
                  {...form.register("proxyHost")}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
